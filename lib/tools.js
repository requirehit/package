var Util = require( 'findhit-util' );

exports.pathToRegExpFilter = function ( str ) {

    if ( Util.isnt.String( str ) ) {
        throw new TypeError( "please provide a valid path string filter" );
    }

    return new RegExp(
        '^' +
        (   str
            .replace( '**', '[a-z_\-\s0-9\.\\]*' )
            .replace( '*', '[a-z_\-\s0-9\.]*' )
        ) +
        '$',
        'i'
    );
};

exports.fileMatchesAgainstRegExpFiltersArray = function ( path, filters ) {

    for( var i in filters ) {
        if ( path.match( filters[ i ] ) ) {
            return true;
        }
    }

    return false;
};
