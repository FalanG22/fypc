const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use('/', require('./routes/dashboard'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/comprobantes', require('./routes/comprobantes'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/tesoreria', require('./routes/tesoreria'));
app.use('/api/contabilidad', require('./routes/contabilidad'));
app.use('/api/geografia', require('./routes/geografia'));
app.use('/api/schema', require('./routes/schema'));
app.use('/api/rrhh', require('./routes/rrhh'));
app.use('/api/produccion', require('./routes/produccion'));
app.use('/api/logistica', require('./routes/logistica'));
app.use('/api/obras', require('./routes/obras'));
app.use('/api/ecommerce', require('./routes/ecommerce'));
app.use('/api/impuestos', require('./routes/impuestos'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/activosfijos', require('./routes/activosfijos'));
app.use('/api/auxiliares', require('./routes/auxiliares'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/cobranzas', require('./routes/cobranzas'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/compras-tesoreria', require('./routes/compras_tesoreria'));
app.use('/api/maestros', require('./routes/maestros'));
app.use('/api/ctacte', require('./routes/ctacte'));

app.listen(PORT, () => {
  console.log(`ERP Viewer corriendo en http://localhost:${PORT}`);
});
