module.exports = {
    apps: [
        {
            name: 'stock-dashboard',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 55055 // Google AI Studio model
            },
        },
    ],
};
