require('dotenv').config();
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL length:', process.env.DATABASE_URL.length);
  console.log('DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 30) + '...');
} else {
  console.log('DATABASE_URL is not set');
}
