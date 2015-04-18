var Package = require( '../lib/package' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {

    describe( 'Bluebird', function () {
        var bluebird;

        before(function () {
            bluebird = new Package( 'bluebird' );

            return bluebird.load();
        });

        it( 'should have set name as "bluebird"', function () {
            expect( bluebird.name ).to.be.equal( 'bluebird' );
        });

        it( 'should have no required dependencies', function () {
            expect( bluebird.dependencies.required ).to.deep.equal( {} );
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../node_modules/bluebird/package.json' )
                )
            ).to.be.equal(
                bluebird.path
            );
        });

    });

});
