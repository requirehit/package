var Package = require( '../../lib/package' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {

    describe( 'Twitter Bootstrap', function () {
        var bootstrap;

        before(function () {
            bootstrap = new Package( 'bootstrap' );

            return bootstrap.load();
        });

        it( 'should have set name as "bootstrap"', function () {
            expect( bootstrap.name ).to.be.equal( 'bootstrap' );
        });

        it( 'should have no required dependencies', function () {
            expect( bootstrap.dependencies.required ).to.deep.equal( {} );
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../../node_modules/bootstrap/package.json' )
                )
            ).to.be.equal(
                bootstrap.path
            );
        });

    });

});
