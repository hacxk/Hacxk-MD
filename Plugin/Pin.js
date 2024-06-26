const { proto } = require("@whiskeysockets/baileys");

module.exports = (Command) => {
    Command({
        cmd: 'pin',
        desc: 'Pin a message in a group (if bot is admin)',
        react: "📌",
        type: 'GROUP COMMANDS',
        handler: async (m, sock) => {
            try {
                const { remoteJid, participant } = m.key;

                // Check if the command is used in a group
                if (!remoteJid.endsWith('@g.us')) {
                    await sendWithReaction(sock, remoteJid, "❌", "This command can only be used in groups.", m);
                    return;
                }

                // Check if the command sender is the owner or the bot itself
                const allowedNumbers = global.botSettings.ownerNumbers.map(num => num + '@s.whatsapp.net');
                allowedNumbers.push(sock.user.id); // Add the bot's number to allowed numbers

                if (!allowedNumbers.includes(participant)) {
                    await sendWithReaction(sock, remoteJid, "🚫", "Only the owner or bot can pin a message.", m);
                    return;
                }

                // Check if the bot is an admin in the group
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const botId = sock.user.id.replace(/:.*$/, "") + "@s.whatsapp.net";
                const botIsAdmin = groupMetadata.participants.some(p => p.id.includes(botId) && p.admin);

                if (!botIsAdmin) {
                    await sendWithReaction(sock, remoteJid, "🤖", "I cannot pin messages because I am not an admin in this group.", m);
                    return;
                }

                await sock.sendMessage(remoteJid, { text: 'Now send the message you want to pin!' }, { quoted: m });

                // Define the event handler within the closure
                const messageHandler = async ({ messages }) => {
                    for (let msg of messages) {
                        const user = msg.key.remoteJid.endsWith('@g.us') ? msg.key.participant : msg.key.remoteJid;

                        // Check if the message is valid (not undefined, empty, or a service message)
                        if (!msg.message || !Object.keys(msg.message).length || msg.message.isEphemeral) {
                            continue; // Skip processing invalid messages
                        }

                        const owner = m.key.remoteJid.endsWith('@g.us') ? m.key.participant : m.key.remoteJid;

                        if (user === owner) {
                            await replyHandler(msg, m, sock);
                            sock.ev.off('messages.upsert', messageHandler); // Stop listening to messages.upsert event after replying
                            return; // Only process the first valid message from the owner
                        }
                    }
                };

                // Attach the event listener
                sock.ev.on('messages.upsert', messageHandler);

            } catch (error) {
                console.error("Error sending message:", error);
                await sendWithReaction(sock, remoteJid, "⚠️", "An error occurred while processing your request.", m);
            }
        }
    });
};

const replyHandler = async (msg, m, sock) => {
    try {
        // Pin the message for everyone
        await sock.relayMessage(m.key.remoteJid, {
            pinInChatMessage: {
                key: msg.key,
                type: proto.Message.PinInChatMessage.Type.PIN_FOR_ALL,
                senderTimestampMs: new Date().getTime()
            },
            messageContextInfo: {
                messageAddOnDurationInSecs: 2592000 // 30 days in seconds
            }
        }, { messageId: msg.key.id });

        await sendWithReaction(sock, m.key.remoteJid, "📌", "Message pinned successfully!", m);
    } catch (error) {
        console.error("Error pinning message:", error);
        await sendWithReaction(sock, m.key.remoteJid, "⚠️", "Failed to pin the message.", m);
    }
};

// Helper function to send a message with a reaction and WhatsApp font hacks
async function sendWithReaction(sock, remoteJid, reaction, text, m) {
    // Apply WhatsApp font hacks (bold, italic, etc.) to the text message
    const formattedText = text
        .replace(/\*(.+?)\*/g, "*$1*")   // Bold
        .replace(/_(.+?)_/g, "_$1_")    // Italics
        .replace(/~(.+?)~/g, "~$1~");   // Strikethrough

    await msg.react(reaction, m);
    await msg.reply(formattedText, m);
}
