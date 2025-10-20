class ChunkedUploader {
  constructor() {
    this.chunkSize = 5 * 1024 * 1024; // 5MB chunks - good for large files
    this.maxRetries = 3; // Retry failed chunks 3 times
  }

  async uploadFile(file) {
    // Calculate how many chunks we need
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const uploadId = this.generateUploadId(); // Unique ID for this upload
    
    // Show progress bar
    this.showProgressBar();
    
    // Upload each chunk one by one
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      // Cut the file into chunks
      const chunk = file.slice(
        chunkIndex * this.chunkSize,
        Math.min((chunkIndex + 1) * this.chunkSize, file.size)
      );
      
      // Upload this chunk
      await this.uploadChunk(chunk, chunkIndex, totalChunks, file.name, uploadId);
      
      // Update progress bar
      const progress = ((chunkIndex + 1) / totalChunks) * 100;
      this.updateProgress(progress, `Uploading chunk ${chunkIndex + 1} of ${totalChunks}`);
    }
    
    // Tell the server to combine all chunks
    await this.completeUpload(file.name, totalChunks, uploadId);
    this.updateProgress(100, 'Upload completed successfully!');
  }

  async uploadChunk(chunk, chunkIndex, totalChunks, fileName, uploadId) {
    // Try up to 3 times if it fails
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Convert the chunk to base64 for sending
        const base64Chunk = await this.blobToBase64(chunk);

        // Send to our Netlify function
        const response = await fetch('/.netlify/functions/upload-chunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chunk: base64Chunk,
            fileName: fileName,
            chunkIndex: chunkIndex,
            totalChunks: totalChunks,
            uploadId: uploadId
          })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        return result;
        
      } catch (error) {
        console.error(`Upload attempt ${attempt + 1} failed:`, error);
        
        // If this was our last try, give up
        if (attempt === this.maxRetries - 1) {
          throw new Error(`Failed to upload chunk after ${this.maxRetries} attempts`);
        }
        
        // Wait before trying again (1s, then 2s, then 4s)
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  async completeUpload(fileName, totalChunks, uploadId) {
    const response = await fetch('/.netlify/functions/complete-upload', {
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

    if (!response.ok) {
      throw new Error('Failed to complete upload');
    }

    return await response.json();
  }

  // Convert file chunk to base64 for transmission
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:application/octet-stream;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  // Generate a unique ID for this upload session
  generateUploadId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Create and show progress bar
  showProgressBar() {
    let progressContainer = document.getElementById('uploadProgressContainer');
    
    // Create progress bar if it doesn't exist
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'uploadProgressContainer';
      progressContainer.style.margin = '20px 0';
      progressContainer.style.padding = '15px';
      progressContainer.style.border = '1px solid #ddd';
      progressContainer.style.borderRadius = '5px';
      
      progressContainer.innerHTML = `
        <div id="uploadStatus" style="margin-bottom: 10px; font-weight: bold;">Preparing upload...</div>
        <div style="background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden;">
          <div id="uploadProgressBar" style="background: #4CAF50; width: 0%; height: 100%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;"></div>
        </div>
      `;
      
      // Add it to the page (you might want to adjust where it goes)
      const uploadButton = document.getElementById('uploadButton');
      uploadButton.parentNode.insertBefore(progressContainer, uploadButton.nextSibling);
    }
    
    progressContainer.style.display = 'block';
  }

  // Update progress bar and status text
  updateProgress(percent, message) {
    const progressBar = document.getElementById('uploadProgressBar');
    const status = document.getElementById('uploadStatus');
    
    if (progressBar) {
      progressBar.style.width = percent + '%';
      progressBar.textContent = Math.round(percent) + '%';
    }
    if (status) {
      status.textContent = message;
    }
  }
}

// Set up the upload button when page loads
document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  
  // Make sure we have the necessary elements
  if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', async function() {
      const files = fileInput.files;
      
      // Check if a file was selected
      if (files.length === 0) {
        alert('Please select a file first.');
        return;
      }
      
      const file = files[0];
      const uploader = new ChunkedUploader();
      
      try {
        // Disable button during upload
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
        
        // Start the upload process
        await uploader.uploadFile(file);
        
        // Success!
        uploadButton.textContent = 'Upload Complete!';
        setTimeout(() => {
          uploadButton.disabled = false;
          uploadButton.textContent = 'Upload File';
        }, 3000);
        
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Upload failed: ' + error.message);
        
        // Reset button
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload File';
      }
    });
  } else {
    console.error('Could not find file input or upload button');
  }
});