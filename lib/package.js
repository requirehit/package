var Promise = require( 'bluebird' ),
    Class = require( 'findhit-class' ),
    Util = require( 'findhit-util' ),

    debug = require( 'debug' )( 'requirehit:package' );

// -----------------------------------------------------------------------------

/**
 * @name Package
 * @constructor
 *
 * Handles package related methods
 **/
var Package = module.exports = Class.extend({

    statics: {
        RegExp: {
            DependencyRule: /^(required|optional|(environment-(required|optional)-.*))$/i,
        },
    },

    options: {

        name: undefined,
        version: undefined,
        description: undefined,

        /**
         * path (required)
         *
         * module name OR
         * path to package dir
         *
         * string
         */
        path: false,


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
         */
        dependencies: false,


        /**
         * environment
         *
         * define environment this is running
         */
        environment: 'development',


        storage: 'local',

        loadOnInitialize: true,
        buildOnInitialize: true,
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

        debug( 'initialize package on %s', options.path );

        this.resetIO();
        this.setEnvironment( options.environment );

        // Bootstrap some things
        if ( options.loadOnInitialize ) {
            this.load()
            .then(function () {
                if ( options.dependencies ) {
                    this.setDependencies( options.dependencies );
                }
            })
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

    resetIO: function () {
        this.resetInput();
        this.resetOutput();
    },

    /**
     * validate - returns a promise which will be fulfilled if everything is as
     * it is supposed to be.
     *
     * @return {Promise}
     */
    load: function ( force ) {

        // Check if it has already been loaded
        if( this._loaded && ! force ) {
            return this._loaded;
        }

        var options = this.options;

        debug( 'loading package on %s', options.path );

        return this._loaded = Promise.cast().bind(this)
        .then(function () {

            debug( 'trying to load package.json first' );

            try {
                var pj = require( options.path + '/package.json' );
            } catch ( err ) {
                // Will return in case of file not found :p
                return;
            }

            this.parseOptionsFromPackageJSON( pj );
        })
        .then(function () {

            if ( ! options.name ) {
                throw new TypeError( "please provide options.name" );
            }

            this.name = options.name;

            if ( ! options.version ) {
                throw new TypeError( "please provide options.version" );
            }

            this.version = options.version;

        });
    },

    parseOptionsFromPackageJSON: function ( pj ) {
        debug( 'parsing package.json' );

        var options = this.options;

        options.name = options.name || pj.name || undefined;
        options.version = options.version || pj.version || undefined;
        options.description = options.description || pj.description || undefined;
        options.dependencies = options.dependencies || pj.dependencies || undefined;

    },

    setEnvironment: function ( environment ) {
        if ( Util.isnt.String( environment ) || ! environment ) {
            throw new TypeError( "invalid environment provided" );
        }

        this.environment = environment;
    },

    setDependencies: function ( dependencies ) {

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
                    if ( dependency.matches( Package.RegExp.DependencyRule ) ) {
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

        // We may have everything now, I will initialize `this.dependencies`
        this.dependencies = dependencies;

        return true;
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

        //
    },


    /**
     * @name Package.addInput
     *
     * Adds a string into input
     *
     * @param   {String}    file    string with filename
     * @
     */
    addInput: function ( file, content ) {

        if ( this.input[ file ] ){
            throw new Error( "We already have an ouput with that path" );
        }

        // save into input
        this.input[ file ] = content;

        return true;
    },

    removeInput: function ( file ) {

        if ( ! this.input[ file ] ) {
            throw new Error( "It seems that the input you're trying to remove doesn't exist" );
        }

        // Delete key from input
        delete this.input[ file ];

        return true;
    },

    /**
     * @name Package.resetInput
     *
     * Resets input object by iterating and deleting keys on original object
     */
    resetInput: function () {

        this.input = this.input || {};

        for( var k in this.input ) {
            delete this.input[ k ];
        }

    },


    /**
     * @name Package.addOutput
     *
     * Adds a string into output
     *
     * @param   {String}    file    string with filename
     * @
     */
    addOutput: function ( file, content ) {

        if ( this.output[ file ] ){
            throw new Error( "We already have an ouput with that path" );
        }

        // save into output
        this.output[ file ] = content;

        return true;
    },

    removeOutput: function ( file ) {

        if ( ! this.output[ file ] ) {
            throw new Error( "It seems that the output you're trying to remove doesn't exist" );
        }

        // Delete key from output
        delete this.output[ file ];

        return true;
    },

    /**
     * @name Package.resetOutput
     *
     * Resets output object by iterating and deleting keys on original object
     */
    resetOutput: function () {

        this.output = this.output || {};

        for( var k in this.output ) {
            delete this.output[ k ];
        }

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
     },

});

// Handle associations
//Package.hasOne( 'Storage', require( 'requirehit-storage' ) );
//Package.hasMany( 'Adapters', require( 'requirehit-adapter' ) );
