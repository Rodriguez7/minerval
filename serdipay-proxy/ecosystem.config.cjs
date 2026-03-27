module.exports = {
  apps: [
    {
      name: "serdipay-proxy",
      script: "index.js",
      cwd: "/opt/serdipay-proxy",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4010,
      },
    },
  ],
};
