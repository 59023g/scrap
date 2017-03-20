const secrets = require( './secrets.js' );

const twilio = require( 'twilio' )( secrets.twilioSid, secrets.twilioSecret );
const request = require( 'request-promise' );
const cheerio = require( 'cheerio' );


let parseBody = ( res ) => {
  let today = new Date()

  if ( res.statusCode !== 200 ) return Promise.reject( new Error( `req error: statusCode: ${ res.statusCode }` ) );
  let $ = cheerio.load( res.body );
  let results = [];

  $( 'li.result-row' ).each( function( i, elem ) {
    let time = new Date( $( this ).find( '.result-date' ).attr( 'datetime' ) )
    let price = ''
    let text = $( this ).find( '.result-title' ).text();
    let url = $( this ).find( '.result-title' ).attr( 'href' );
    let img = '';

    if ( time.getDate() === today.getDate() && today.getMonth() === time.getMonth() ) {
      results.push( [ text, url ] )
    }

  } );

  return Promise.resolve( results )
}

let getShortUrl = ( results ) => {
  return new Promise( ( resolve, reject ) => {

    if ( results.length === 0 ) return Promise.resolve( `No matches today` )

    let loopPromiseArr = [];

    for ( let i = 0; i < results.length; i++ ) {

      let rawUrl = results[ i ][ 1 ];
      let url = '';

      if ( rawUrl.includes( '//' ) ) {
        url = `https:${ rawUrl }`
      } else {
        url = secrets.hostName + rawUrl
      }

      loopPromiseArr.push(
        new Promise( ( resolve, reject ) => {
            let options = {
              method: 'POST',
              uri: 'https://www.googleapis.com/urlshortener/v1/url?key=' + secrets.googl,
              body: {
                longUrl: url
              },
              json: true
            }

            request( options )
              .then( shortUrl => {
                results[ i ].pop();
                return resolve( results[ i ].concat( shortUrl.id ) );
              } )
              .catch( err => reject( err ))
          }
        ) )
    }

    Promise.all( loopPromiseArr )
      .then( success => {
        resolve( success )
      } )
      .catch( err => {
        reject( '')
      } );

  } )
}

let sendSms = ( results ) => {

  for ( let i = 0; i < results.length; i++ ) {
    twilio.messages.create( {
      body: results[ i ][1],
      to: secrets.to,
      from: secrets.from
    }, function( err, data ) {
      if ( err ) {
        console.error( 'Could not notify administrator' );
        console.error( err );
      } else {
        console.log( 'Administrator notified' );
      }
    } );

  }

}

let run = () => {
  request( {
      uri: secrets.hostName + secrets.reqPath,
      resolveWithFullResponse: true
    } )
    .then( parseBody )
    .then( getShortUrl )
    .then( sendSms )
    .catch( err => console.log( err ) )
}


run()
