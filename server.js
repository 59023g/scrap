const http = require( 'http' )
const url = require( 'url' )

const scrap = require( './scrap.js' )

// for set interval, run the scrape every hour
const intervalCheck = 3600000;

let startServer = () => {

  // create basic http server
  http.createServer( ( req, res ) => {
    let urlParts = url.parse( req.url );
    switch ( urlParts.pathname ) {
      case "/stove":
        scrap.run( res )
        break;
      default:
        res.statusCode = 404
        res.end( '' )
        break;
    }
  } ).listen( 4000 )

  // run on first init
  scrap.run();

  // every hour
  setInterval( scrap.run, intervalCheck );

}

startServer();
