const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Templating & static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Sessions for cart
app.use(
  session({
    secret: 'super-secret-key-change-me',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
  })
);

// Load products (from JSON for simplicity)
const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');
function loadProducts() {
  const raw = fs.readFileSync(PRODUCTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

// Helpers
function ensureCart(req) {
  if (!req.session.cart) req.session.cart = [];
}
function findProduct(id) {
  const products = loadProducts();
  return products.find(p => p.id === id);
}
function cartTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = subtotal > 0 ? 4.99 : 0;
  const tax = +(subtotal * 0.1).toFixed(2);
  const total = +(subtotal + shipping + tax).toFixed(2);
  return { subtotal, shipping, tax, total };
}

// Middleware to inject cart count
app.use((req, res, next) => {
  ensureCart(req);
  res.locals.cartCount = req.session.cart.reduce((s, i) => s + i.qty, 0);
  next();
});

// Routes
app.get('/', (req, res) => {
  const products = loadProducts();
  res.render('index', { products, title: 'Home' });
});

app.get('/product/:id', (req, res) => {
  const prod = findProduct(req.params.id);
  if (!prod) return res.status(404).send('Product not found');
  res.render('product', { product: prod, title: prod.name });
});

app.post('/cart/add', (req, res) => {
  ensureCart(req);
  const { id, qty } = req.body;
  const product = findProduct(id);
  if (!product) return res.status(400).send('Invalid product');
  const quantity = Math.max(1, parseInt(qty || '1', 10));
  const existing = req.session.cart.find(i => i.id === id);
  if (existing) existing.qty += quantity; else req.session.cart.push({ ...product, qty: quantity });
  res.redirect('/cart');
});

app.post('/cart/update', (req, res) => {
  ensureCart(req);
  const { id, qty } = req.body;
  const quantity = Math.max(0, parseInt(qty || '1', 10));
  req.session.cart = req.session.cart
    .map(i => (i.id === id ? { ...i, qty: quantity } : i))
    .filter(i => i.qty > 0);
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  ensureCart(req);
  const { id } = req.body;
  req.session.cart = req.session.cart.filter(i => i.id !== id);
  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  ensureCart(req);
  res.render('cart', { cart: req.session.cart, totals: cartTotals(req.session.cart), title: 'Your Cart' });
});

app.get('/checkout', (req, res) => {
  ensureCart(req);
  res.render('checkout', { cart: req.session.cart, totals: cartTotals(req.session.cart), title: 'Checkout' });
});

app.post('/checkout', (req, res) => {
  // Mock checkout — in real apps, integrate a payment gateway (Stripe/Razorpay/etc.)
  ensureCart(req);
  const totals = cartTotals(req.session.cart);
  // Clear cart after mock purchase
  req.session.cart = [];
  res.render('checkout', { cart: [], totals, title: 'Order Placed' });
});

app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
