const secrets = require( './secrets.js' );

const twilio = require( 'twilio' )( secrets.twilioSid, secrets.twilioSecret );
const request = require( 'request-promise' );
const cheerio = require( 'cheerio' );
const moment = require( 'moment' );


// parses response, uses jquery of nodejs: cherrio, to travel page's DOM string
let parseBody = ( res ) => {

  if ( res.statusCode !== 200 ) return Promise.reject( new Error( `req error: statusCode: ${ res.statusCode }` ) );

  let $ = cheerio.load( res.body );
  let results = [];

  $( 'li.result-row' ).each( function( i, elem ) {
    let postTime = $( this ).find( '.result-date' ).attr( 'datetime' );
    let url = $( this ).find( '.result-title' ).attr( 'href' );

    // check if post within the hour
    if ( isWithinTheHour( postTime ) ) {
      results.push( [ url ] )
    }

  } );

  if ( results.length === 0 ) {
    return Promise.reject( 'parseBody(): no results' )
  }

  return Promise.resolve( results )
}


// this shortens the url because carrier's block messages which contain a craigslist URL - ideally i would not be using google for this
let getShortUrl = ( results ) => {
  return new Promise( ( resolve, reject ) => {

    if ( results.length === 0 ) return Promise.resolve( `No matches today` )

    let loopPromiseArr = [];

    for ( let i = 0; i < results.length; i++ ) {

      let rawUrl = results[ i ][ 0 ];
      let url = '';

      // if the rawUrl is from outside sf it returns with new city in hostname
      // this is for the 'results in your area postings, which we want here'
      if ( rawUrl.includes( '//' ) ) {
        url = `https:${ rawUrl }`
      } else {
        url = secrets.hostName + rawUrl
      }

      // loop through each result and convert longurl to short
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
              // i'm replacing the orginal url with the parsed one
              results[ i ].pop();
              return resolve( results[ i ].concat( shortUrl.id ) );
            } )
            .catch( err => reject( err ) )
        } ) )
    }

    Promise.all( loopPromiseArr )
      .then( success => {
        resolve( success )
      } )
      .catch( err => {
        reject( `getShortUrl() Error: ${ err }` )
      } );

  } )
}

let sendSms = ( results ) => {
  return new Promise( ( resolve, reject ) => {
    let loopPromiseArr = [];

    for ( let i = 0; i < results.length; i++ ) {
      loopPromiseArr.push( twilio.messages.create( {
        body: results[ i ][ 0 ],
        to: secrets.to,
        from: secrets.from
      }, function( err, data ) {
        if ( err ) {
          return Promise.reject( `sendSms(): Error: ${ err }` )
        } else {
          return Promise.resolve( `SendSms(): success:` )
        }
      } ) )

    }

    Promise.all( loopPromiseArr )
      .then( success => {
        resolve( success )
      } )
      .catch( err => {
        reject( `${ err }` )
      } );

  } )

}

let run = ( res ) => {
  request( {
      uri: secrets.hostName + secrets.reqPath,
      resolveWithFullResponse: true
    } )
    .then( parseBody )
    .then( results => {
      if ( res ) console.log( `${ results.length }`)
      getShortUrl( results )
    })
    .then( sendSms )
    .then( result => console.log( 'result success', result ) )
    .catch( err => {
      // ideally results.length 0 should not be an error
      if ( res ) res.end( `${ 0 }`)
      console.log( err )
    })
}

// util

// ideally this would interface with intervalCheck
let isWithinTheHour = ( postTime ) => {
  let now = moment().utc()
  let post = moment( postTime ).utc()
  let diff = moment.duration( now - post ).asHours();
  if ( diff <= 1 ) {
    return true
  }
  return false
}

module.exports = { run: run }
