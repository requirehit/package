var Package = require( '../lib/package' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {
    describe( 'jQuery', function () {
        var jQuery;

        before(function () {
            jQuery = new Package( 'jquery' );

            return jQuery.load();
        });

        it( 'should have jQuery dependencies', function () {
            expect( jQuery.name ).to.be.equal( 'jquery' );
        });

        it( 'test', function () {
            console.log( jQuery );
        })

    });
});
