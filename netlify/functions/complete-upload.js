const fetch = require('node-fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { fileName, totalChunks, uploadId } = body;

    console.log(`Completing upload for: ${fileName}, total chunks: ${totalChunks}`);

    // Tell the droplet to combine all chunks into one file
    const dropletResponse = await fetch('http://207.154.244.220:3000/api/combine-chunks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: fileName,
        totalChunks: totalChunks,
        uploadId: uploadId
      })
    });

    if (!dropletResponse.ok) {
      throw new Error('Droplet server error');
    }

    const result = await dropletResponse.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'File upload completed successfully!',
        fileName: fileName 
      })
    };
    
  } catch (error) {
    console.error('Complete upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error: ' + error.message })
    };
  }
};