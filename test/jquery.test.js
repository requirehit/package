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

        it( 'should have name set as "jquery"', function () {
            expect( jQuery.name ).to.be.equal( 'jquery' );
        });

        it( 'should have no required dependencies', function () {
            expect( jQuery.dependencies.required ).to.deep.equal( {} );
        });

    });

});
