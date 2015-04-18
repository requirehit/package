var Package = require( '../lib/package' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {

    describe( 'jQuery UI', function () {
        var jQueryUI;

        before(function () {
            jQueryUI = new Package( 'jquery-ui' );

            return jQueryUI.load();
        });

        it( 'should have name set as "jquery-ui"', function () {
            expect( jQueryUI.name ).to.be.equal( 'jquery-ui' );
        });

        it( 'should have no required dependencies', function () {
            expect( jQueryUI.dependencies.required ).to.deep.equal({
                // Should have jquery on it, it should be changed once PR
                // jquery/jquery-ui#1537 is solved.
                // "jquery": "2.x"
            });
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../node_modules/jquery-ui/package.json' )
                )
            ).to.be.equal(
                jQueryUI.path
            );
        });

    });

});
