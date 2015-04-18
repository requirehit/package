var Promise = require( 'bluebird' ),
    Class = require( 'findhit-class' ),
    Util = require( 'findhit-util' ),
    Module = require( 'module' ),
    path = require( 'path' ),
    Walker = require( 'walker' ),

    debug = require( 'debug' )( 'requirehit:package' );

// -----------------------------------------------------------------------------

/**
 * @name Package
 * @constructor
 *
 * Handles package related methods
 **/
var Package = module.exports = Class.extend({

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
         * WARNING: This option overlaps `options.exclude`, that means that it
         * won't have any effect if you set this instead.
         *
         * here you can set multiple strings which will be converted into
         * RegExps to *choose which files goes into package*.
         *
         * @string or @array of @strings
         */
        includeOnly: false,


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

    walk: function () {
        var package = this;
        return new Promise(function ( fulfill, reject ) {

            // Create a new walker
            var walk = new Walker( package.path );

            // Handle files
            walk.on( 'file', function ( filename, stats ) {

                // Filter files by excluding paths that are matched with
                // `options.exclude`

                console.log( filename );

            });

            // Handle walk errors
            walk.on( 'error', reject );

            // Handle walk end
            walk.on( 'end', fulfill );

        });
    },

    resetContents: function () {
        this.contents = {};
    },

    /**
     * validate - returns a promise which will be fulfilled if everything is as
     * it is supposed to be.
     *
     * @return {Promise}
     */
    load: function ( force ) {
        var self = this;

        // Check if it has already been loaded
        if( this._loaded && ! force ) {
            return this._loaded;
        }

        var options = this.options;

        debug( '%s: loading package', this.name );

        return this._loaded = Promise.cast().bind(this)

        // Check for files into folder
        .then(function () {
            return this.walk();
        });
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

        ignore = ignore ||
            this.options.ignore ||
            this.npmPackage && this.npmPackage.ignore ||

            // TODO
            // try to fetch from .rhignore
            // try to fetch from .npmignore
            // try to fetch from .gitignore

            [];

        // if ignore is string, convert it into an array
        if ( ignore && typeof ignore === 'string' ) {
            ignore = [ ignore ];
        }

        if ( ! ignore || Util.isnt.Array( ignore ) ) {
            throw new TypeError( "please provide a valid package.ignore" );
        }

        // TODO:
        // check if strings are valid and can be converted into RegExp


        this.ignore = ignore;

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

        this.pipelining = {};

        Util.Object.each( pipelining, function ( adapters, filter ) {
            return package.addPipelining( filter, adapters );
        });

    },

    addPipelining: function ( filter, adapters ) {
        var package = this;

        // Check if filter is valid

        // add adapters and filter to pipelining object
        package.pipelining[ filter ] =

            Util.Array.map( adapters, function ( adapter ) {
                adapter = this.resolveAdapter( adapter );

                if ( ! package.hasAdapter( adapter ) ) {
                    package.bind( adapter );
                }

                return adapter;
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

    },

    build: function ( rebuild ) {

        // validate resources

        // if already built and not asked to rebuild
        // return _build

        // check if there are some adapters available

        // ask adapters to prepare configs
        // adapters.configure

        // ask adapters to start building
        // adapters.build

        // save build into _build

        // return _build
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
