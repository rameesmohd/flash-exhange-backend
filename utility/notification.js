const notificationModel = require('../model/notification')

const generateMessage = () => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const phone = `87****${Math.floor(1000 + Math.random() * 9000)}`;
  const min = 100, max = 3000;
  const amount = (Math.floor(Math.random() * ((max - min) / 5 + 1)) * 5 + min).toFixed(2);

  return `${time} ${phone} sold $${amount}`;
};

// Helper: Random delay between 20 and 200 seconds
const getRandomDelay = () => {
  const min = 20000;   // 20 seconds
  const max = 200000;  // 200 seconds
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const insertRandomly = async () => {
  try {
    const message = generateMessage();
    await notificationModel.create({ message, createdAt: new Date() });

    const nextDelay = getRandomDelay();
    console.log(`✅ Inserted: "${message}" | Next in ${Math.floor(nextDelay / 1000)}s`);

    setTimeout(insertRandomly, nextDelay);
  } catch (err) {
    console.error('❌ Notification insert failed:', err);
    setTimeout(insertRandomly, 60000); // Retry after 60 seconds
  }
};

// Start the cycle
insertRandomly();