/**
 * RideLocal AI Chat Widget
 * Frontend integration for AI Agent service
 */

class RideLocalAIChat {
    constructor(options = {}) {
        this.aiServiceUrl = options.aiServiceUrl || '/api/ai';
        this.conversationId = localStorage.getItem('ridelocal_ai_conversation_id');
        this.userId = options.userId || null;
        this.authToken = options.authToken || null;
        this.onMessage = options.onMessage || null;
        this.onError = options.onError || null;
        this.onStateChange = options.onStateChange || null;
    }

    /**
     * Send a message to the AI agent
     */
    async sendMessage(message) {
        try {
            const response = await fetch(`${this.aiServiceUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.conversationId,
                    user_id: this.userId,
                    auth_token: this.authToken
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Update conversation ID
            this.conversationId = data.conversation_id;
            localStorage.setItem('ridelocal_ai_conversation_id', this.conversationId);
            
            // Trigger callbacks
            if (this.onMessage) {
                this.onMessage(data);
            }
            
            if (this.onStateChange && data.state) {
                this.onStateChange(data.state);
            }
            
            return data;
            
        } catch (error) {
            console.error('Error sending message to AI:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Update authentication context
     */
    setAuth(userId, authToken) {
        this.userId = userId;
        this.authToken = authToken;
    }

    /**
     * Reset conversation
     */
    resetConversation() {
        this.conversationId = null;
    }

    /**
     * Check if AI service is available
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.aiServiceUrl}/health`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('AI service health check failed:', error);
            return null;
        }
    }
}

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RideLocalAIChat;
}