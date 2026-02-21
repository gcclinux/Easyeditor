// Environment Variable Checker for Tauri
console.log('=== Environment Variables Check ===');
console.log('VITE_GOOGLE_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('VITE_GOOGLE_CLIENT_APP:', import.meta.env.VITE_GOOGLE_CLIENT_APP ? 'SET' : 'NOT SET');
console.log('VITE_GOOGLE_CLIENT_SECRET:', import.meta.env.VITE_GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('VITE_GOOGLE_API_KEY:', import.meta.env.VITE_GOOGLE_API_KEY ? 'SET' : 'NOT SET');
console.log('===================================');