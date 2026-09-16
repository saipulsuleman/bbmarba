require('dotenv').config();
const app = require('./lib/serverApp');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⛽ SISTEM OPERASIONAL BBM SPBU 74-962-29`);
  console.log(`🌐 Server aktif di: http://localhost:${PORT}`);
  console.log(`🔐 Login Kasir:    admin / SPBUMarisa2406`);
  console.log(`👑 Login Godmode:  godmode / Saipul123$`);
  console.log(`======================================================\n`);
});
