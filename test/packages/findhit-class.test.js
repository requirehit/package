var Package = require( '../../lib/package' ),
    path = require( 'path' ),
    chai = require( 'chai' ),
    expect = chai.expect;

describe( 'Package', function () {

    describe( 'findhit class', function () {
        var Class;

        before(function () {
            Class = new Package( 'findhit-class' );

            return Class.load();
        });

        it( 'should have set name as "findhit-class"', function () {
            expect( Class.name ).to.be.equal( 'findhit-class' );
        });

        it( 'should have "findhit-util" on its required dependencies', function () {
            expect( Object.keys( Class.dependencies.required ) ).to.deep.equal([
                'findhit-util'
            ]);
        });

        it( 'should have right path resolved', function () {
            expect(
                path.dirname(
                    require.resolve( '../../node_modules/findhit-class/package.json' )
                )
            ).to.be.equal(
                Class.path
            );
        });

    });

});
