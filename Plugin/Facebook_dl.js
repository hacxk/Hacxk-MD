const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = (Command) => {
    Command({
        cmd: ['fb', 'facebook'],
        desc: 'Download Facebook video',
        react: '📥',
        type: 'DOWNLOAD COMMANDS',
        handler: async (m, sock) => {
            try {
                // Extract the URL from the message
                const query = m.message?.conversation.split(' ').slice(1).join(' ')
                    || m.message?.extendedTextMessage?.text.split(' ').slice(1).join(' ');

                if (!query) {
                    await msg.reply('Please provide a Facebook video URL.', m);
                    return;
                }

                // Fetch data from the API
                await msg.react('🔍', m);
                const response = await axios.get(`https://api.junn4.my.id/download/facebook?url=${query}`);
                const { status, result } = response.data;
                const maxSizeInMB = global.botSettings.directDlLimitinMB[0];

                if (status === 200) {
                    // Function to get the video size
                    const getVideoSize = async (url) => {
                        const response = await axios.head(url);
                        return parseFloat(response.headers['content-length']) / (1024 * 1024); // Convert size to MB
                    };

                    let videoUrl = result.video_hd;

                    // Check the size of the HD video
                    const videoSize = await getVideoSize(result.video_hd);

                    if (videoSize > maxSizeInMB) {
                        // If the HD video size is greater than the max size, use the SD version
                        videoUrl = result.video_sd;
                    }

                    // Ensure the downloads directory exists
                    const downloadsDir = path.join(__dirname, 'downloads');
                    if (!fs.existsSync(downloadsDir)) {
                        fs.mkdirSync(downloadsDir);
                    }

                    // Download the video
                    await msg.react('⬇️', m);
                    const time = new Date().getTime();
                    const videoFilePath = path.join(downloadsDir, `temp_video_${time}.mp4`);
                    const writer = fs.createWriteStream(videoFilePath);
                    const downloadResponse = await axios({
                        url: videoUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    downloadResponse.data.pipe(writer);

                    // Wait until the download is completed
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    await msg.react('⬆️', m);
                    // Send the video
                    await sock.sendMessage(
                        m.key.remoteJid,
                        {
                            video: fs.readFileSync(videoFilePath),
                            mimetype: 'video/mp4',
                            height: 1152,
                            width: 2048,
                            caption: `*𝘏𝘈𝘊𝘒𝘚𝘜𝘔𝘋*`
                        },
                        { quoted: m }
                    );
                    await msg.react('✅', m);
                    // Clean up the downloaded file
                    fs.unlinkSync(videoFilePath);
                } else {
                    await msg.reply('Failed to fetch video details. Please try again later.', m);
                }
            } catch (error) {
                console.error(error);
                await msg.reply('An error occurred while processing your request.', m);
            }
        }
    });
};
