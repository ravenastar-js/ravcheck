/**
 * ⚡ Configurações de Rate Limit para API Free do urlscan.io
 */
module.exports = {
    // Limites do plano Free
    limits: {
        // Public Scans
        public: {
            perMinute: 60,
            perHour: 500,
            perDay: 5000
        },
        // Unlisted Scans
        unlisted: {
            perMinute: 60,
            perHour: 100,
            perDay: 1000
        },
        // Private Scans
        private: {
            perMinute: 5,
            perHour: 50,
            perDay: 50
        },
        // Search Requests
        search: {
            perMinute: 120,
            perHour: 1000,
            perDay: 1000
        },
        // Result Retrieve
        retrieve: {
            perMinute: 120,
            perHour: 5000,
            perDay: 10000
        }
    },

    // Tempo de reset
    resetTimes: {
        daily: "12:00 AM UTC",
        hourly: "Top of each hour",
        minute: "Every minute"
    },

    // Headers de rate limit
    headers: {
        remaining: 'X-Rate-Limit-Remaining',
        reset: 'X-Rate-Limit-Reset',
        limit: 'X-Rate-Limit-Limit',
        scope: 'X-Rate-Limit-Scope'
    },

    // Códigos de status HTTP relevantes
    statusCodes: {
        OK: 200,
        CREATED: 201,
        ACCEPTED: 202,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
        SERVICE_UNAVAILABLE: 503
    },

    // Mensagens de erro amigáveis
    errorMessages: {
        401: 'Chave API inválida ou expirada',
        403: 'Acesso negado. Verifique suas permissões',
        404: 'Recurso não encontrado',
        429: 'Rate limit excedido. Aguarde alguns minutos',
        500: 'Erro interno do servidor',
        503: 'Serviço temporariamente indisponível'
    },

    // Estratégias de retry
    retryStrategies: {
        rateLimit: {
            maxRetries: 3,
            baseDelay: 60000, // 1 minuto
            maxDelay: 300000  // 5 minutos
        },
        serverError: {
            maxRetries: 2,
            baseDelay: 30000, // 30 segundos
            maxDelay: 120000  // 2 minutos
        }
    },

    /**
     * Obtém os limites baseados no tipo de visibilidade
     * @param {string} visibility - Visibilidade (public, unlisted, private)
     * @returns {Object} Limites para a visibilidade
     */
    getLimitsByVisibility(visibility) {
        switch (visibility) {
            case 'public':
                return this.limits.public;
            case 'unlisted':
                return this.limits.unlisted;
            case 'private':
                return this.limits.private;
            default:
                return this.limits.public;
        }
    },

    /**
     * Calcula a porcentagem de uso
     * @param {number} used - Quantidade usada
     * @param {number} limit - Limite total
     * @returns {Object} Porcentagem e status
     */
    calculateUsage(used, limit) {
        const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

        let status = 'low';
        let color = 'success';

        if (percentage >= 80) {
            status = 'critical';
            color = 'error';
        } else if (percentage >= 50) {
            status = 'warning';
            color = 'warning';
        }

        return {
            used: used,
            limit: limit,
            percentage: percentage,
            remaining: limit - used,
            status: status,
            color: color
        };
    }
};