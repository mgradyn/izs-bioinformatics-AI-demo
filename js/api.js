export async function sendChatMessage(sessionId, message) {
    try {
        const payload = {
            session_id: sessionId,
            message: message
        };

        const response = await fetch('https://izs-llm.me/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data; 
    } catch (error) {
        console.error('API call error:', error);
        return { status: 'failed', error: error.message };
    }
}
