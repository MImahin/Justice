import React, { useState, useRef, useEffect } from 'react';
import { Upload, Wand2, Download, RotateCcw, Play, Pause } from 'lucide-react';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const [userImages, setUserImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mosaicGenerated, setMosaicGenerated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetBlocks, setTargetBlocks] = useState(null);
  const [settings] = useState({ blockSize: 8, tolerance: 15 });

  const loadTargetBlocks = async () => {
    try {
      const response = await fetch('/target_blocks.json');
      if (!response.ok) throw new Error('Could not load target_blocks.json');
      const blocks = await response.json();
      setTargetBlocks(blocks);
    } catch (err) {
      console.log("Using random generation mode");
    }
  };

  useEffect(() => {
    loadTargetBlocks();
  }, []);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const loadedImages = [];
    let loadedCount = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);
          
          const imageData = ctx.getImageData(0, 0, 32, 32);
          const data = imageData.data;
          let totalY = 0;
          for (let i = 0; i < data.length; i += 4) {
            totalY += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          }

          loadedImages.push({
            img,
            avgY: totalY / (32 * 32),
            used: 0,
          });

          loadedCount++;
          setUploadProgress(Math.round((loadedCount / files.length) * 100));
          if (loadedCount === files.length) {
            setUserImages(loadedImages);
            setUploadProgress(0);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const findClosestImage = (blockY, images, maxUsage, tolerance) => {
    const candidates = images.filter(img => img.used < maxUsage && Math.abs(img.avgY - blockY) <= tolerance);
    const unusedCandidates = candidates.filter(img => img.used === 0);
    let chosen;
    if (unusedCandidates.length > 0) {
      chosen = unusedCandidates[Math.floor(Math.random() * unusedCandidates.length)];
    } else if (candidates.length > 0) {
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      chosen = images.reduce((closest, img) => Math.abs(img.avgY - blockY) < Math.abs(closest.avgY - blockY) ? img : closest);
    }
    chosen.used++;
    return chosen;
  };

  const generateMosaic = async () => {
    if (userImages.length === 0) return;

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    setLoading(true);
    setMosaicGenerated(true);
    setProgress(0);

    // Wait for canvas to mount
    await new Promise(r => setTimeout(r, 600));

    try {
      const blocks = targetBlocks || Array.from({ length: 60 }, () => Array.from({ length: 80 }, () => Math.random() * 255));
      const gridHeight = blocks.length;
      const gridWidth = blocks[0].length;
      const { blockSize, tolerance } = settings;
      
      const canvas = canvasRef.current;
      canvas.width = gridWidth * blockSize;
      canvas.height = gridHeight * blockSize;
      const ctx = canvas.getContext('2d');

      const numBlocks = gridWidth * gridHeight;
      const maxUsagePerImage = Math.max(1, Math.floor(numBlocks / userImages.length) * 2);
      userImages.forEach(img => img.used = 0);

      for (let row = 0; row < gridHeight; row++) {
        for (let col = 0; col < gridWidth; col++) {
          const blockY = blocks[row][col];
          const imgObj = findClosestImage(blockY, userImages, maxUsagePerImage, tolerance);

          // DRAW ORIGINAL IMAGE (NO TINTING/FACTOR)
          ctx.drawImage(
            imgObj.img, 
            col * blockSize, 
            row * blockSize, 
            blockSize, 
            blockSize
          );
        }
        
        // Visual progress update
        setProgress(Math.round(((row + 1) / gridHeight) * 100));
        await new Promise(r => setTimeout(r, 1)); 
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const toggleAudio = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="justice-container">
      <audio ref={audioRef} src="/justice-music.mp3" loop preload="auto" />
      
      <div className="justice-content">
        <header className="justice-header">
          <h1 className="justice-title">JUSTICE</h1>
        </header>

        <div className="justice-main">
          {!mosaicGenerated ? (
            <div className="justice-upload-section">
              <div className="upload-container">
                <label htmlFor="fileInput" className="upload-box">
                  <input id="fileInput" ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} className="file-input" />
                  <Upload className="upload-icon" />
                  <p className="upload-text">Upload Your Images</p>
                </label>
                {uploadProgress > 0 && <p className="status-text">Uploading: {uploadProgress}%</p>}
                {userImages.length > 0 && <div className="images-loaded">✓ {userImages.length} images ready</div>}
                
                <button onClick={generateMosaic} disabled={userImages.length === 0} className="generate-button">
                  <Wand2 className="button-icon" /> GENERATE MOSAIC
                </button>
              </div>
            </div>
          ) : (
            <div className="justice-result-section">
           
            {loading && (
              <div className="progress-wrapper">
                <div className="progress-bar-container">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-text-small">Generating: {progress}%</p>
              </div>
            )}

              <div className="result-container" style={{ display: loading ? 'none' : 'flex' }}>
                <div className="canvas-wrapper">
                  <canvas ref={canvasRef} className="result-canvas" />
                </div>
                <div className="result-actions">
                  <button onClick={toggleAudio} className="audio-button">
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    {isPlaying ? " Pause" : " Play Music"}
                  </button>
                  <button onClick={() => {
                    const link = document.createElement('a');
                    link.href = canvasRef.current.toDataURL();
                    link.download = 'mosaic.png';
                    link.click();
                  }} className="download-button"><Download size={16} /> Download</button>
                  <button onClick={() => window.location.reload()} className="reset-button"><RotateCcw size={16} /> Reset</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;