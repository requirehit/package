var Promise = require( 'bluebird' ),
    Builder = require( 'requirehit-builder' ),
    Util = require( 'findhit-util' ),
    Module = require( 'module' ),
    fs = require( 'fs' ),
    path = require( 'path' ),
    Walker = require( 'walker' ),
    tools = require( './lib/tools' ),

    debug = require( 'debug' )( 'requirehit:package' );

// -----------------------------------------------------------------------------

/**
 * @name PackageBuilder
 * @constructor
 *
 * Handles package related methods
 **/
var PackageBuilder = module.exports = Builder.extend({

    /**
     * Package Statics
     */
    statics: {

        /**
         * RegExp
         *
         * they will be exposed as a static class variable, so internal or third
         * party plugins could use them also.
         */
        RegExp: {

            /**
             * Dependency Rule
             *
             * This regexp checks if provided keys of `dependencies` object are
             * valid or note.
             *
             * Mostly it does is check if it is:
             * - required
             * - optional
             * - environment-required-**
             *
             */
            DependencyRule:
            /^(required|optional|(environment-(required|optional)-.*))$/i,

        },
    },

    options: {


        /**
         * Package name
         *
         * @string
         */
        name: undefined,


        /**
         * Package version
         *
         * @string
         */
        version: undefined,


        /**
         * Package description
         *
         * will *NOT* be used on production environment
         *
         * @string
         */
        description: undefined,


        /**
         * configFile (required)
         *
         * config file name without extension, because
         * then we should seek for `.js` or `.json`
         *
         * @string
         */
        configFile: 'Rhfile',


        /**
         * path (required)
         *
         * module name OR
         * path to package dir
         *
         * @string
         */
        path: false,


        /**
         * ignore
         *
         * here you can set multiple strings which will be converted into
         * RegExps to *choose which files should be excluded from package*.
         *
         * @string or @array of @strings
         */
        ignore: false,


        /**
         * includeOnly
         *
         * WARNING: This option overlaps `options.ignore`, that means that it
         * won't have any effect if you set this instead.
         *
         * here you can set multiple strings which will be converted into
         * RegExps to *choose which files goes into package*.
         *
         * @string or @array of @strings
         */
        includeOnly: false,


        /**
         * pipelining
         *
         * this options allows you to set which priority we should take when
         * passing files trough adapters
         *
         * `{ '**.less': [ 'less', 'css', 'gzip' ] }`
         *
         * During package build, this would take:
         * - each `.less` file and pass the stream
         * - `less` builder would capture that stream and return another stream
         * with `less` data converted into `css` data
         * - `css` would only check for errors on your `css` file and return
         * exacly the same data
         * - `gzip` builder would gather previous adapter's stream and return
         * a compressed `data` stream
         *
         * That means that you would end with a gzip packed file.
         *
         * During package load ( on browser side ), browser should have already
         * `loaders` of each `adapter` used on each build and reverse pipelining:
         * - `gzip` loader would take that `compressed` stream and return an
         * uncompressed `stream`
         * - `css` would return exacly the same stream but would apply css into
         * the browser.
         * - `less` would just do nothing because `css` did everything we wanted
         * to.
         *
         * This adds endless options on `requirehit`, you could have dialects of
         * `css` or `js` that would build already on server, you could do shitty
         * things as compressing your images for better loading performance, or
         * even greater, you could encode movies into different formats!
         *
         * You might be thinking, encoding movies, insane right? Well, we are
         * trying to include streamed xhr requests, so, not so insane!!
         * You could stream packages! In fact, they would load while loading. :)
         *
         *
         * @object with @string paths as keys and @array as values with @strings
         * as adapters definition
         */
        pipelining: false,

        /**
         * dependencies (optional)
         *
         * Should be an object with dependencies per need.
         * Each need should contain another object with dependencies described
         * like you would describe on a regular `package.json`.
         * Needs are:
         *  - required - will be loaded before this package, usage is similar to
         * CommonJS specs, as you would do on `node.js` or `io.js`.
         *     - API: `require( module )`
         *     - Usage Example: `var Module = require( 'module' )`
         *
         *  - optional - modules you place here will load always on async mode,
         * even if we have it on memory (you could use this method if you prefer
         * async loading on all modules). We have three ways for loading async
         * modules, by returning a promise, by callback or by directly giving
         * up a `module` variable with some state variables and `module.exports`
         *      - API: `require( module, way )`
         *      - Usage Examples:
         *
         *  Promise way
         *  ```
         *  return methodWhichReturnsPromise()
         *  .then(function () {
         *      var modules = {};
         *
         *      if ( doINeedOptionableOne ) {
         *          modules.one = require( 'one', 'promise' );
         *      }
         *
         *      if ( doINeedOptionableTwo ) {
         *          modules.two = require( 'two', 'promise' );
         *      }
         *
         *      if ( doINeedOptionableThree ) {
         *          modules.three = require( 'three', 'promise' );
         *      }
         *
         *      return Promise.props( modules );
         *  })
         *  .then(function ( modules ) {
         *      // at this point, modules are already available
         *      // module.one -> One
         *      // module.two -> Two
         *      // module.three -> Three
         *  })
         *  ```
         *
         *
         *  Callback way
         *  ```
         *  require( 'one', function ( one ) {
         *      // at this point, module one is already available
         *  });
         *  ```
         *
         *  Module way
         *  ```
         *  var module = require( 'one' );
         *
         *  // `module.loaded` is false at this point
         *  // when it changes status, module will be available through
         *  // `module.exports`
         *
         *  ```
         *
         *  - environment-(required|optional)-(your_environment)
         *
         * That means that, if you want to run some tests on your package, and
         * your test environment is `testing`, you should set them into
         * `environment-testing`.
         *
         * Example:
         *
         * {
         *     "required": {
         *          "findhit-util": "1.1.2",
         *          "findhit-class": "^1.0.0",
         *     },
         *     "optional": {},
         *     "environment-required-testing": {
         *          "mocha": "^3.0.0",
         *     },
         * }
         *
         * @object
         */
        dependencies: false,


        /**
         * environment
         *
         * define environment this is running
         *
         * @string
         */
        environment: 'development',


        /**
         * storage
         *
         * defines where we should store packed source
         * defaults to: requirehit local storage
         *
         * you should provide an already constructed storage
         *
         * @storage
         */
        storage: false,


        /**
         * adapters
         *
         * set which adapters should work on top of this package
         * defaults to: [ 'requirehit-adapter-js' ]
         *
         * @array of ( @string | @adapter )
         */
        adapters: undefined,


        /* INITIALIZE OPTIONS */

        /**
         * loadOnInitialize
         *
         * config that will allow auto-run of `load` method
         *
         * @boolean
         */
        loadOnInitialize: true,


        /**
         * buildOnInitialize
         *
         * config that will allow auto-run of `build` method
         *
         * @boolean
         */
        buildOnInitialize: true,


        /**
         * storeOnInitialize
         *
         * config that will allow auto-run of `store` method
         * this will only have effect if `buioldOnInitialize` option is also
         * set as true
         *
         * @boolean
         */
        storeOnInitialize: true,


    },


    /**
     * @name Package.initialize
     *
     * @param  {Object} options
     * @param  {String} options.path    path to package dir
     * @param
     * @return {Package}                instanceof Package
     */
    initialize: function ( options ) {

        // If options is a string, will have the same behavior as { path: XXX }
        if ( Util.is.String( options ) ) {
            options = { path: options };
        }

        options = this.setOptions( options );

        // Validations
        if ( ! options.path ) {
            throw new TypeError( "please provide options.path" );
        }

        try{
            this.npmPackage = require( options.path + '/package.json' );
        } catch( err ) {
            this.npmPackage = false;
        }

        try{
            this.configFile = require( options.path + '/Rhfile' );
        } catch( err ) {
            this.configFile = false;
        }


        this.main =
            options.main ||
            this.npmPackage && this.npmPackage.main ||
            this.configFile && this.configFile.main ||
            undefined;

        // Trying to determine path
        this.path = // Trying to get it by:

            // applying dirname on package.json
            this.npmPackage &&
            path.dirname( require.resolve( options.path + '/package.json' ) ) ||

            // applying dirname on Rhfile
            this.configFile &&
            path.dirname( require.resolve( options.path + '/Rhfile' ) ) ||

            this.name &&
            // removing this.main from resolved path
            require.resolve( options.path ).replace( this.name, '' ) ||

            false;

        if ( ! this.path ) {
            throw new Error( "i was unable to determine absolute path" );
        }

        this.resetContents();
        this.setEnvironment( options.environment );

        this.setName();
        this.setVersion();
        this.setDescription();
        this.setIgnore();
        this.setIncludeOnly();
        this.setDependencies();
        this.setAdapters();
        this.setPipelining();

        debug( '%s: package initialized', this.name );

        // Bootstrap some things
        if ( options.loadOnInitialize ) {
            this.load()
            .then(function () {
                if ( options.buildOnInitialize ) {
                    this.build();

                    if ( options.storeOnInitialize ) {
                        this.store();
                    }
                }
            });
        }
    },

    resetContents: function () {
        this.contents = [];
    },

    /**
     * validate - returns a promise which will be fulfilled if everything is as
     * it is supposed to be.
     *
     * @return {Promise}
     */
    load: function ( force ) {
        var package = this;

        // Check if it has already been loaded
        if( package._loaded && ! force ) {
            return package._loaded;
        }

        var options = package.options;

        debug( '%s: loading package', package.name );

        package._loaded = Promise.cast().bind(this)

        // Grab files as readable streams
        .then(function () {
            return new Promise(function ( fulfill, reject ) {

                // Create a new walker
                var walk = new Walker( package.path );

                // Handle files
                walk.on( 'file', function ( filepath, stats ) {

                    // Remove base path from file
                    var relativePath = filepath.replace( package.path + '/', '' );

                    // Filter files by excluding paths that are matched with
                    // `options.ignore`
                    if ( package.includeOnly ) {

                        // if relativePath doesn't match with filter, return
                        if ( ! tools.fileMatchesAgainstRegExpFiltersArray(
                                relativePath, package.includeOnly
                        )) {
                            return;
                        }

                    } else if ( package.ignore ) {

                        // if relativePath matches with filter, return
                        if ( tools.fileMatchesAgainstRegExpFiltersArray(
                                relativePath, package.ignore
                        )) {
                            return;
                        }

                    }

                    // cretae a content
                    var content = Util.extend(
                        {
                            path: filepath,
                            relative: relativePath,
                            stream: undefined,
                            adapters: undefined,
                        },
                        path.parse( filepath )
                    );

                    // lets populate adapters by taking them from pipelining
                    for( var i in package.pipelining ) {
                        var pipelining = package.pipelining[ i ];
                        if ( pipelining.filter ) {
                            content.adapters = pipelining.adapters;
                            break;
                        }
                    }

                    // In case we didn't found a pipelining that matches, lets
                    // try to directly from adapters
                    // TODO
                    // WE SHOULD REALLY DO THIS TODO TODO TODO TODO
                    // HEYYY DO ME!!

                    // Push content into contents
                    package.contents.push( content );

                });

                // Handle walk errors
                walk.on( 'error', reject );

                // Handle walk end
                walk.on( 'end', fulfill );

            });
        });

        return package._loaded;
    },


    /**
     * setName function - sets name
     *
     * @param  {String} name
     */
    setName: function ( name ) {

        name = name ||
            this.options.name ||
            this.npmPackage && this.npmPackage.name ||
            undefined;

        if ( ! name ) {
            throw new TypeError( "please provide a valid package.name" );
        }

        this.name = name;

    },

    /**
     * setVersion function - sets version
     *
     * @param  {String} version
     */
    setVersion: function ( version ) {

        version = version ||
            this.options.version ||
            this.npmPackage && this.npmPackage.version ||
            undefined;

        if ( ! version ) {
            throw new TypeError( "please provide a valid package.version" );
        }

        this.version = version;

    },

    /**
     * setDescription function - sets description
     *
     * @param  {String} description
     */
    setDescription: function ( description ) {

        // We don't need description on production environments
        if ( this.environment === 'production' ) {
            return;
        }

        description = description ||
            this.options.description ||
            this.npmPackage && this.npmPackage.description ||
            undefined;

        this.description = description;

    },

    setIgnore: function ( ignore ) {
        var options = this.options,
            package = this;

        ignore = ignore ||
            options.ignore ||
            this.npmPackage && this.npmPackage.ignore ||

            // try to fetch from .rhignore
            (function () {
                try {
                    var ign = fs.readFileSync( package.path + '/' + '.rhignore' );
                    return (ign + '').split( "\n" );
                } catch ( err ) {}
            })() ||

            // try to fetch from .npmignore
            (function () {
                try {
                    var ign = fs.readFileSync( package.path + '/' + '.npmignore' );
                    return (ign + '').split( "\n" );
                } catch ( err ) {}
            })() ||

            // try to fetch from .gitignore
            (function () {
                try {
                    var ign = fs.readFileSync( package.path + '/' + '.gitignore' );
                    return (ign + '').split( "\n" );
                } catch ( err ) {}
            })() ||

            [];

        // if ignore is string, convert it into an array
        if ( ignore && typeof ignore === 'string' ) {
            ignore = [ ignore ];
        }

        if ( ! ignore || Util.isnt.Array( ignore ) ) {
            throw new TypeError( "please provide a valid package.ignore" );
        }

        ignore = Util.Array.filter( ignore, function ( val ){
            return !! val;
        });

        // Add basic stuff to ignore array
        ignore.push(

            // Always ignore hidden files
            // WARNING:
            // Is this messing up with your code? I dont mean to be rude but,
            // why are you using js hidden files? :|
            '.**'

        );

        // check if strings are valid and can be converted into RegExp
        this.ignore = ignore.map( tools.pathToRegExpFilter );

    },

    setIncludeOnly: function ( includeOnly ) {
        var options = this.options,
            package = this;

        includeOnly = includeOnly ||
            options.includeOnly ||
            this.npmPackage && this.npmPackage.includeOnly ||
            false;

        // if includeOnly is string, convert it into an array
        if ( includeOnly && typeof includeOnly === 'string' ) {
            includeOnly = [ includeOnly ];
        }

        if ( includeOnly && Util.isnt.Array( includeOnly ) ) {
            throw new TypeError( "please provide a valid package.includeOnly" );
        }

        if ( includeOnly ) {
            includeOnly = Util.Array.filter( includeOnly, function ( val ){
                return !! val;
            });
        }

        // check if strings are valid and can be converted into RegExp
        this.includeOnly =
            includeOnly && includeOnly.map( tools.pathToRegExpFilter ) ||
            false;
    },

    /**
     * setAdapters function - sets adapters
     *
     * @param  {String} adapters
     */
    setAdapters: function ( adapters ) {
        var package = this;

        adapters = adapters ||
            this.options.adapters ||
            this.npmPackage && this.npmPackage.adapters ||
            [ 'js' ];

        if ( Util.is.String( adapters ) ) {
            adapters = adapters.split(',');
        }

        if( Util.isnt.Array( adapters ) ) {
            throw new TypeError( "please provide a valid package.adapters" );
        }

        this.adapters = {};

        // Create adapters and link into package
        Util.Array.each( adapters, function ( adapter ) {
            package.bindAdapter( adapter );
        });

    },

    resolveAdapter: function ( adapter ) {
        adapter =
            typeof adapter === 'object' && adapter.name && adapter ||
            typeof adapter === 'string' && (
                [
                    // these adapters are reserved for
                    'js', 'coffeescript', 'css', 'less', 'blob', 'dummy'
                ].indexOf( adapter ) !== -1 && require( 'requirehit-adapter-' + adapter ) ||
                require( adapter )
            ) ||
            false;

        if ( ! adapter || ! adapter.name ) {
            throw new TypeError( "invalid adapter provided" );
        }

        return adapter;
    },

    hasAdapter: function ( adapter ) {
        adapter = this.resolveAdapter( adapter );
        return this.adapters[ adapter.name ] === 'undefined';
    },

    bindAdapter: function ( adapter ) {
        adapter = this.resolveAdapter( adapter );
        this.adapters[ adapter.name ] = adapter;
        return adapter;
    },

    unbindAdapter: function ( adapter ) {
        adapter = this.resolveAdapter( adapter );
        delete this.adapters[ adapter.name ];
    },

    setPipelining: function ( pipelining ) {
        var package = this;

        pipelining =
            this.options.pipelining ||
            this.npmPackage && this.npmPackage.pipelining ||
            this.configFile && this.configFile.pipelining ||
            {};

        if ( Util.isnt.Object ( pipelining ) ) {
            throw new TypeError( "please provide a valid options.pipelining" );
        }

        this.pipelining = [];

        Util.Object.each( pipelining, function ( adapters, filter ) {
            return package.addPipelining( filter, adapters );
        });

    },

    addPipelining: function ( filter, adapters ) {
        var package = this;

        // Check if filter is valid
        filter = tools.pathToRegExpFilter( filter );

        // add adapters and filter to pipelining object
        adapters =
            Util.Array.map( adapters, function ( adapter ) {
                adapter = this.resolveAdapter( adapter );

                if ( ! package.hasAdapter( adapter ) ) {
                    package.bind( adapter );
                }

                return adapter;
            });

        this.pipelining.push({
            filter: filter,
            adapters: adapters,
        });

        return true;
    },

    setEnvironment: function ( environment ) {

        environment = environment ||
            this.options.environment ||
            this.npmPackage && this.npmPackage.environment ||
            undefined;

        this.environment = environment;

    },

    setDependencies: function ( dependencies ) {
        var options = this.options;

        dependencies = dependencies ||
            this.options.dependencies ||
            this.npmPackage && this.npmPackage.dependencies ||
            {};

        // First of all, lets check if there is at least an expected key, if
        // there isn't, it means that you provided an object with dependencies
        // already!!
        if ( Util.is.Object( dependencies ) ) {
            var keys = Object.keys( dependencies );

            try {
                keys.forEach(function ( dependency ) {

                    // Check if it is a string
                    // and throw a TypeError course
                    if (  Util.isnt.String( dependency ) ) {
                        throw new TypeError("dependency should be a string");
                    }

                    // If there is an expected key, i will throw an error!
                    // Calm down, just for flow control...
                    if ( dependency.match( Package.RegExp.DependencyRule ) ) {
                        throw new Error("Seems that you were a nice developer");
                    }

                });

                // seems that dependencies are from `package.json`
                dependencies = {
                    required: dependencies,
                };

            } catch (err) {
                if( err.message !== "Seems that you were a nice developer" ) {
                    // What? real error over here!!!
                    // throw it again like a hot potatooeeeeee
                    throw err;
                }
            }
        }

        // I will accept arrays with module names, but versions would be always
        // `latest`, be carefoulletwaetweth45l. Thats what could happen to your
        // module if you don't specify version, it will freakout!!!1111
        if ( Util.is.Array( dependencies ) ) {
            var newDependencies = {
                required: {},
            };

            Util.Array.each( dependencies, function ( dependency ) {

                if ( Util.isnt.String( dependency ) ) {
                    throw new TypeError( "dependency should be a string" );
                }

                newDependencies.required[ dependency ] = 'latest';

            });

            dependencies = newDependencies;
        }

        // Now, we should check if every keys on `dependencies` are valid
        Util.Object.each( dependencies, function ( _dependencies, rule ) {

            if ( Util.isnt.String( rule ) ) {
                throw new TypeError( "dependency rule should be a string" );
            }

            if ( ! rule.match( Package.RegExp.DependencyRule ) ) {
                throw new TypeError( "invalid dependency rule" );
            }

        });

        debug( '%s: saving dependencies', this.name );

        // We may have everything now, I will initialize `this.dependencies`
        this.dependencies = dependencies || {};

        // Make sure that we have required and optional objects
        this.dependencies.required = this.dependencies.required || {};
        this.dependencies.optional = this.dependencies.optional || {};

        return true;
    },

    addDependency: function ( packageName, packageVersion, optional ) {
        this.dependencies[ ! optional ? 'required' : 'optional' ][ packageName ] = packageVersion;
    },

    removeDependency: function ( packageName, optional ) {
        delete this.dependencies[ ! optional ? 'required' : 'optional' ][ packageName ];
    },

    writeConfig: function () {
        // TODO
    },

    build: function ( forceRebuild ) {
        var package = this;

        // validate resources

            // contents should have more than one file
            if ( package.contents.length === 0 ) {
                throw new Error( "no contents found for this package" );
            }

            // check if there are some adapters available
            if ( Object.keys( package.adapters ).length === 0 ) {
                throw new Error( "no adapters found for this package" );
            }

        // if already built and not asked to forceRebuild
        if ( package._build && ! forceRebuild ) {
            return package._build;
        }

        // Iterate over contents objects
        package._build = Promise.cast( package.contents )

        // Clone objects so we don't mess arround with original one
        .map(function ( content ) {
            return Util.extend( {}, content );
        })

        // now that we are safe from contents objects
        // lets iterate them
        .map(function ( content ) {

            // Read stream and place it at content.stream
            content.stream = fs.readFile( content.path );

            // pass content sequentially by each adapter by running
            // `.buildStream( stream )`

            for( var i in content.adapters ) {
                var adapter = content.adapters[ i ];
                content.stream = adapter.buildStream( content.stream );
            }

            return content;
        })

        // Now we should transform contents into package readable contents
        .map(function () {
            // TODO
        })

        // Now that we have contents divided by objects
        // lets reduce it into a string
        .reduce(function () {
            // TODO
        })

        // And now, wrap into a package loader readable
        .then(function () {
            // TODO
        });

        return package._build;
    },

    store: function () {

        // validate resources

        // Check if there is a _build present
        // if not, throw error warning that we can't store an unbuilded package

    },

    /**
     * @name Package.toStringFiles
     *
     * Renders package code into an object with file names as keys and their
     * code as values.
     *
     * @return {Object[String]}     Clone of this.output
     */
     toStringFiles: function () {
         return Util.extend( {}, this.output );
     },

    /**
     * @name Package.toString
     *
     * Renders package code into a string so it could be saved or used
     *
     * @return {String}     String to be saved included on bundles and sort of
     */
     toString: function () {
         return this.build();
     }

});
