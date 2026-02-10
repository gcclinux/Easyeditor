# Dropbox Integration Setup Guide

This guide walks you through setting up Dropbox OAuth integration for EasyEditor's EasyNotes feature.

## Overview

To enable users to connect their Dropbox accounts to EasyEditor, you need to:
1. Create a Dropbox App in the Dropbox App Console
2. Configure OAuth settings and permissions
3. Get your App Key (Client ID) and App Secret (Client Secret)
4. Add these credentials to your environment variables

## Step 1: Create a Dropbox App

1. **Go to Dropbox App Console**
   - Visit: https://www.dropbox.com/developers/apps
   - Sign in with your Dropbox account (or create one if needed)

2. **Click "Create app"**

3. **Choose API**
   - Select: **Scoped access** (recommended, modern API)
   - This gives you fine-grained permission control

4. **Choose Access Type**
   - Select: **App folder** (recommended for EasyEditor)
   - This creates a dedicated folder for your app and limits access to only that folder
   - Alternative: **Full Dropbox** (gives access to entire Dropbox, use only if needed)

5. **Name Your App**
   - Enter a unique name, e.g., "EasyEditor" or "EasyEditor Notes"
   - Note: App names must be unique across all Dropbox apps
   - If "EasyEditor" is taken, try variations like "EasyEditor-YourName" or "EasyEditor-Notes"

6. **Click "Create app"**

## Step 2: Configure OAuth Settings

After creating the app, you'll be on the app settings page:

### 2.1 OAuth 2 Settings

1. **Redirect URIs**
   - Add your redirect URIs (where Dropbox sends users after authentication)
   - For development:
     ```
     http://localhost:3024
     http://127.0.0.1:3024
     https://localhost:3024
     ```
   - For production:
     ```
     https://easyeditor.co.uk
     https://www.easyeditor.co.uk
     https://easyedit-cloud.web.app
     ```
   - For Tauri desktop app:
     ```
     http://localhost:3024
     tauri://localhost
     ```

2. **Allow implicit grant** (Optional)
   - Leave this **unchecked** (we're using authorization code flow with PKCE)

### 2.2 Permissions (Scopes)

Scroll down to the "Permissions" tab and enable:

1. **files.content.write**
   - Allows creating, uploading, and modifying files
   - Required for: Creating notes, saving changes

2. **files.content.read**
   - Allows reading and downloading files
   - Required for: Opening notes, listing notes, syncing

**Important**: After changing permissions, you may need to click "Submit" or regenerate your access token for testing.

### 2.3 App Folder Name (if using App folder access)

- The app folder will be created automatically at: `/Apps/YourAppName/`
- EasyEditor will create an "Easyeditor" subfolder inside this: `/Apps/YourAppName/Easyeditor/`
- All notes will be stored in this subfolder

## Step 3: Get Your Credentials

On the app settings page:

1. **App key** (This is your Client ID)
   - Copy this value
   - Example: `abc123def456ghi789`

2. **App secret** (This is your Client Secret)
   - Click "Show" to reveal it
   - Copy this value
   - **Keep this secret!** Never commit it to version control

## Step 4: Add Credentials to Environment Variables

### For Development

Create or update your `.env.local` file in the project root:

```bash
# Dropbox OAuth Credentials (Development)
VITE_DROPBOX_CLIENT_ID=your_app_key_here
VITE_DROPBOX_CLIENT_SECRET=your_app_secret_here
```

### For Production

Set environment variables in your production environment:

```bash
# Dropbox OAuth Credentials (Production)
VITE_DROPBOX_CLIENT_ID_PROD=your_production_app_key
VITE_DROPBOX_CLIENT_SECRET_PROD=your_production_app_secret
```

**Security Notes**:
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Use different apps for development and production if possible
- Rotate secrets periodically
- Store production secrets in your deployment platform's secret manager

## Step 5: Test the Integration

### Development Testing

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Open EasyEditor** in your browser (http://localhost:3024)

3. **Test the OAuth flow**:
   - Open EasyNotes sidebar
   - Click "Connect" next to Dropbox
   - You should be redirected to Dropbox login
   - After approving, you should be redirected back to EasyEditor
   - Dropbox should show as "Connected"

4. **Test file operations**:
   - Create a new note in Dropbox
   - Open the note
   - Edit and save
   - Check your Dropbox to verify the file was created

### Production Testing

Before deploying to production:

1. **Update redirect URIs** in Dropbox App Console to include production URLs
2. **Set production environment variables** in your hosting platform
3. **Test OAuth flow** on production domain
4. **Verify file operations** work correctly

## Troubleshooting

### "Invalid redirect_uri" Error

**Problem**: Dropbox rejects the redirect URI during OAuth flow

**Solution**:
- Verify the redirect URI in your app settings exactly matches the one being used
- Check for trailing slashes (http://localhost:3024 vs http://localhost:3024/)
- Ensure the URI is using the correct protocol (http vs https)

### "Invalid client_id" Error

**Problem**: Dropbox doesn't recognize your App Key

**Solution**:
- Double-check you copied the App Key correctly
- Ensure there are no extra spaces or characters
- Verify the environment variable is being loaded (check browser console)

### "Insufficient permissions" Error

**Problem**: App doesn't have required scopes

**Solution**:
- Go to Permissions tab in Dropbox App Console
- Enable `files.content.write` and `files.content.read`
- Click "Submit" to save changes
- Users may need to re-authenticate to get new permissions

### Files Not Appearing in Dropbox

**Problem**: Notes are created but don't show up in Dropbox

**Solution**:
- If using "App folder" access, files are in `/Apps/YourAppName/Easyeditor/`
- Check the Dropbox web interface or desktop app
- Verify the folder path in your code matches the expected location

### Token Expired Errors

**Problem**: "Token expired" or "Invalid token" errors

**Solution**:
- The implementation includes automatic token refresh
- If refresh fails, users need to reconnect
- Check that refresh tokens are being stored correctly
- Verify token expiry times are being tracked

## App Folder vs Full Dropbox Access

### App Folder (Recommended)

**Pros**:
- More secure - limited access scope
- Users feel safer granting access
- Easier to manage - all files in one place
- Faster approval from Dropbox

**Cons**:
- Files are in `/Apps/YourAppName/` instead of root
- Users need to navigate to this folder to see files outside EasyEditor

**Location**: `/Apps/YourAppName/Easyeditor/`

### Full Dropbox Access

**Pros**:
- Can create folder in root: `/Easyeditor/`
- Users can easily find files in their main Dropbox

**Cons**:
- Requires more permissions
- Users may be hesitant to grant full access
- More responsibility to handle user data correctly

**Location**: `/Easyeditor/`

**Recommendation**: Start with "App folder" access. You can always create a new app with full access later if needed.

## Rate Limits

Dropbox has rate limits for API calls:

- **Individual user**: 300 requests per 15 minutes per user
- **App-wide**: Varies based on app usage

The EasyEditor implementation includes:
- Automatic retry with exponential backoff
- Rate limit error handling
- User-friendly error messages

If you hit rate limits frequently:
- Implement request batching
- Cache file metadata locally
- Reduce sync frequency
- Contact Dropbox for higher limits

## Security Best Practices

1. **Never expose secrets**
   - Keep App Secret in environment variables only
   - Don't commit to version control
   - Don't log secrets in console

2. **Use PKCE** (Proof Key for Code Exchange)
   - Already implemented in the spec
   - Adds extra security layer for OAuth

3. **Validate redirect URIs**
   - Only add trusted domains
   - Use HTTPS in production

4. **Rotate credentials**
   - Periodically generate new App Secret
   - Update environment variables
   - Users will need to reconnect

5. **Monitor usage**
   - Check Dropbox App Console for usage stats
   - Watch for unusual patterns
   - Set up alerts for errors

## Additional Resources

- **Dropbox OAuth Guide**: https://developers.dropbox.com/oauth-guide
- **Dropbox API Documentation**: https://www.dropbox.com/developers/documentation
- **Dropbox API Explorer**: https://dropbox.github.io/dropbox-api-v2-explorer/
- **Dropbox Support**: https://www.dropbox.com/developers/support

## Next Steps

After completing this setup:

1. ✅ Dropbox App created
2. ✅ OAuth settings configured
3. ✅ Credentials added to environment variables
4. ✅ Development testing completed
5. 🔄 Ready to implement the integration (follow tasks.md)
6. 🔄 Production deployment and testing

---

**Need Help?**

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Dropbox API documentation
3. Check browser console for error messages
4. Verify environment variables are loaded correctly
5. Test with Dropbox API Explorer to isolate issues
