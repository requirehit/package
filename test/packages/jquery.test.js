var Package = require( '../../lib/package' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {

    describe( 'jQuery', function () {
        var jQuery;

        before(function () {
            jQuery = new Package( 'jquery' );

            return jQuery.load();
        });

        it( 'should have name set as "jquery"', function () {
            expect( jQuery.name ).to.be.equal( 'jquery' );
        });

        it( 'should have no required dependencies', function () {
            expect( jQuery.dependencies.required ).to.deep.equal( {} );
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../../node_modules/jquery/package.json' )
                )
            ).to.be.equal(
                jQuery.path
            );
        });

    });

});
