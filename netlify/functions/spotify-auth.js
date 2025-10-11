exports.handler = async (event) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (event.httpMethod === 'POST') {
      const { code, redirectUri } = JSON.parse(event.body);
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      });
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        body: JSON.stringify(data)
      };
    }
    
    return {
      statusCode: 405,
      body: 'Method not allowed'
    };
  };