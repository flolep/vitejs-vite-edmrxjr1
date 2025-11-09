exports.handler = async (event) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    console.log('🔐 [NETLIFY] spotify-auth appelé');
    console.log('🔐 [NETLIFY] CLIENT_ID présent:', clientId ? 'OUI' : 'NON');
    console.log('🔐 [NETLIFY] CLIENT_SECRET présent:', clientSecret ? 'OUI' : 'NON');

    if (event.httpMethod === 'POST') {
      const { code, redirectUri, refreshToken, grantType } = JSON.parse(event.body);

      let tokenParams;

      // Déterminer le type de requête : code initial ou refresh
      if (grantType === 'refresh_token' && refreshToken) {
        // Refresh du token
        console.log('🔄 [NETLIFY] Refresh token demandé');
        console.log('🔄 [NETLIFY] Refresh token reçu:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'MANQUANT');

        tokenParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
      } else {
        // Code OAuth initial
        console.log('🔐 [NETLIFY] Code OAuth reçu:', code ? code.substring(0, 20) + '...' : 'MANQUANT');
        console.log('🔐 [NETLIFY] RedirectUri:', redirectUri);

        tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        });
      }

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
        },
        body: tokenParams
      });

      const data = await response.json();
      console.log('🔐 [NETLIFY] Réponse Spotify status:', response.status);
      console.log('🔐 [NETLIFY] access_token présent:', data.access_token ? 'OUI' : 'NON');

      if (grantType === 'refresh_token') {
        console.log('🔄 [NETLIFY] Token rafraîchi avec succès');
      }

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