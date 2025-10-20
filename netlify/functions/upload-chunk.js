const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Set up CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming data
    const body = JSON.parse(event.body);
    const { chunk, fileName, chunkIndex, totalChunks, uploadId } = body;
    
    // Check if we have chunk data
    if (!chunk) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No chunk data provided' })
      };
    }

    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file: ${fileName}`);

    // Send the chunk to your DigitalOcean droplet
    const dropletResponse = await fetch('http://207.154.244.220:3000/api/upload-chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chunk: chunk,
        fileName: fileName,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        uploadId: uploadId
      })
    });

    // Check if the droplet received the chunk
    if (!dropletResponse.ok) {
      throw new Error('Droplet server error');
    }

    const result = await dropletResponse.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        chunkIndex: chunkIndex,
        message: `Chunk ${chunkIndex + 1} uploaded successfully` 
      })
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error: ' + error.message })
    };
  }
};