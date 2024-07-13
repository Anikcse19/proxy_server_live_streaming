const axios = require('axios');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const cors = require('cors'); // Import cors
const fs = require('fs');

const app = express();
const PORT = 8080; // Port for the Express server

app.use(cors()); // Use cors middleware

// Serve the HLS output directory
const outputDir = path.join(__dirname, 'hls_output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}
app.use('/hls', express.static(outputDir));

// Fetch the updated M3U8 Link and Headers
const fetchM3U8Data = async () => {
  const link = "https://raw.githubusercontent.com/byte-capsule/TSports-m3u8-Grabber/main/TSports_m3u8_headers.Json";

  console.log('link',link);
  
  const response = await axios.get(link);

  console.log('responses',response.data);
  return response.data;
};

// Extract the specific channel data for channel 02
const getChannelData = (data, channelName) => {
  return data.channels.find(channel => channel.name === channelName);
};

// Test the M3U8 Link and Cookie via Requesting TSports Server
const testM3U8Link = async (link, headers) => {
  try {
    const response = await axios.get(link, { headers });
    if (response.status === 200) {
      console.log("😀 M3U8 Link and Cookies are Working.....");
      console.log("✓ Response From TSports Server:", response.data);
      return true;
    }
  } catch (error) {
    console.error("🤧 M3U8 Link and Cookies are Not Working.....");
    console.error("✓ Response From TSports Server:", error.response ? error.response.data : error.message);
    return false;
  }
};

// Main function to download and serve the HLS stream
const startStream = async () => {
  const data = await fetchM3U8Data();
  const channelData = getChannelData(data, "T Sports Live 01");

  if (!channelData) {
    console.error("Channel not found");
    return;
  }

  const { link, headers } = channelData;
  console.log("✓ Channel link: " + link);
  console.log("✓ Channel Headers:", headers);

  const isLinkValid = await testM3U8Link(link, headers);

  if (!isLinkValid) return;

  // Construct the FFmpeg command with correct headers
  const ffmpegCommand = ffmpeg()
    .input(link)
    .inputOptions([
      `-headers`, `Cookie: ${headers['Cookie']}\r\nHost: ${headers['Host']}\r\nUser-agent: ${headers['User-agent']}\r\n`
    ])
    .outputOptions([
      '-c copy',
      '-f hls',
      '-hls_time 2',
      '-hls_list_size 6',
      '-hls_flags append_list+delete_segments+program_date_time+temp_file',
      `-hls_segment_filename ${outputDir}/stream_%04d.ts`
    ])
    .output(`${outputDir}/stream.m3u8`);

  // Run the FFmpeg command
  ffmpegCommand.on('start', () => {
    console.log('FFmpeg process started');
  }).on('end', () => {
    console.log('FFmpeg process finished');
  }).on('error', (err) => {
    console.error('Error in FFmpeg process:', err.message);
  }).run();

  // Serve the HLS stream URL
  app.get('/stream-url', (req, res) => {
    res.json({ url: 'http://localhost:8080/hls/stream.m3u8' });
  });
};

startStream();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
