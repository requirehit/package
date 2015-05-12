var Package = require( '../../../' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package.Builder', function () {

    describe( 'findhit util', function () {
        var Util;

        before(function () {
            Util = new Package.Builder( 'findhit-util' );

            return Util.load();
        });

        it( 'should have set name as "findhit-util"', function () {
            expect( Util.name ).to.be.equal( 'findhit-util' );
        });

        it( 'should have no required dependencies', function () {
            expect( Util.dependencies.required ).to.deep.equal({});
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../../node_modules/findhit-util/package.json' )
                )
            ).to.be.equal(
                Util.path
            );
        });

    });

});
