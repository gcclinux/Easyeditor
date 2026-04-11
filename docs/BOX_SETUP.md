# Box Integration Setup Guide

This guide walks you through setting up Box OAuth integration for EasyEditor's EasyNotes feature.

## Overview

To enable users to connect their Box accounts to EasyEditor, you need to:
1. Create a Box App in the Box Developer Console
2. Configure OAuth 2.0 settings and scopes
3. Get your Client ID and Client Secret
4. Add these credentials to your environment variables

## Step 1: Create a Box App

1. **Go to Box Developer Console**
   - Visit: https://app.box.com/developers/console
   - Sign in with your Box account (or create one if needed)

2. **Click "Create New App"**

3. **Select App Type**
   - Select: **Custom App**
   - This is the standard option for OAuth 2.0 integrations

4. **Choose Authentication Method**
   - Select: **User Authentication (OAuth 2.0)**
   - This enables the standard OAuth 2.0 flow with PKCE support

5. **Name Your App**
   - Enter a unique name, e.g., "EasyEditor" or "EasyEditor Notes"
   - Add a description (optional but recommended)

6. **Click "Create App"**

## Step 2: Configure OAuth Settings

After creating the app, navigate to the app's "Configuration" tab:

### 2.1 OAuth 2.0 Redirect URIs

1. **Redirect URIs**
   - Scroll to the "OAuth 2.0 Redirect URI" section
   - Add your redirect URIs (where Box sends users after authentication)
   - For development:
     ```
     http://localhost:3024/box-oauth-callback.html
     ```
   - For production:
     ```
     https://easyeditor.co.uk/box-oauth-callback.html
     ```
   - For Tauri desktop app:
     ```
     http://localhost:3024/box-oauth-callback.html
     ```

2. **CORS Domains**
   - Add allowed origins for CORS requests:
     ```
     http://localhost:3024
     https://easyeditor.co.uk
     ```

### 2.2 Application Scopes

In the "Application Scopes" section, enable:

1. **Read all files and folders stored in Box**
   - Required for: Listing notes, downloading files

2. **Write all files and folders stored in Box**
   - Required for: Creating notes, uploading, saving changes, deleting

These correspond to the `root_readwrite` scope which grants full read/write access to the user's Box content.

**Important**: After changing scopes, save your configuration. Users may need to re-authenticate to get updated permissions.

### 2.3 Application Folder

- EasyEditor will create an "Easyeditor" folder in the root of the user's Box account
- All notes will be stored in this folder
- The folder is created automatically on first connection

## Step 3: Get Your Credentials

On the app's "Configuration" tab:

1. **Client ID**
   - Located in the "OAuth 2.0 Credentials" section
   - Copy this value
   - Example: `abc123def456ghi789jkl012mno345pq`

2. **Client Secret**
   - Located in the "OAuth 2.0 Credentials" section
   - Click "Fetch Client Secret" to reveal it
   - Copy this value
   - **Keep this secret!** Never commit it to version control

## Step 4: Add Credentials to Environment Variables

### For Development

Create or update your `.env.local` file in the project root:

```bash
# Box OAuth Credentials (Development)
VITE_BOX_CLIENT_ID=your_client_id_here
VITE_BOX_CLIENT_SECRET=your_client_secret_here
```

### For Production

Set environment variables in your production environment:

```bash
# Box OAuth Credentials (Production)
VITE_BOX_CLIENT_ID_PROD=your_production_client_id
VITE_BOX_CLIENT_SECRET_PROD=your_production_client_secret
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
   - Click "Connect" next to Box
   - You should see a Box login popup
   - After approving, the popup should close and return to EasyEditor
   - Box should show as "Connected"

4. **Test file operations**:
   - Create a new note in Box
   - Open the note
   - Edit and save
   - Check your Box account to verify the file was created in the "Easyeditor" folder

### Production Testing

Before deploying to production:

1. **Update redirect URIs** in Box Developer Console to include production URLs
2. **Set production environment variables** in your hosting platform
3. **Test OAuth flow** on production domain
4. **Verify file operations** work correctly

## Troubleshooting

### "Invalid redirect_uri" Error

**Problem**: Box rejects the redirect URI during OAuth flow

**Solution**:
- Verify the redirect URI in your app settings exactly matches the one being used
- Box requires an exact match including path (e.g., `/box-oauth-callback.html`)
- Ensure the URI is using the correct protocol (http vs https)
- Check for trailing slashes

### "Invalid client_id" Error

**Problem**: Box doesn't recognize your Client ID

**Solution**:
- Double-check you copied the Client ID correctly
- Ensure there are no extra spaces or characters
- Verify the environment variable is being loaded (check browser console)
- Confirm the app is not in a disabled state in the Developer Console

### "Insufficient permissions" Error

**Problem**: App doesn't have required scopes

**Solution**:
- Go to Configuration tab in Box Developer Console
- Enable "Read all files and folders" and "Write all files and folders" scopes
- Save the configuration
- Users may need to re-authenticate to get new permissions

### Files Not Appearing in Box

**Problem**: Notes are created but don't show up in Box

**Solution**:
- Files are stored in the "Easyeditor" folder in the root of your Box account
- Check the Box web interface at https://app.box.com
- Verify the folder was created successfully
- Check browser console for API errors

### Token Expired Errors

**Problem**: "Token expired" or "Invalid token" errors

**Solution**:
- The implementation includes automatic token refresh
- If refresh fails, users need to reconnect
- Check that refresh tokens are being stored correctly
- Box access tokens expire after 60 minutes
- Box refresh tokens expire after 60 days of inactivity

### "Rate limited" Error

**Problem**: Too many API requests in a short period

**Solution**:
- Box enforces rate limits on API calls
- Wait a moment and retry the operation
- The implementation includes automatic retry handling
- If persistent, reduce the frequency of operations

## Box API Specifics

### Token Lifetimes

- **Access Token**: Expires after 60 minutes
- **Refresh Token**: Expires after 60 days of inactivity (single use — each refresh returns a new refresh token)

### Upload Endpoint

Box uses a separate upload endpoint from its main API:
- **Main API**: `https://api.box.com/2.0/`
- **Upload API**: `https://upload.box.com/api/2.0/`

This is handled automatically by the EasyEditor implementation.

### Folder Structure

```
Box Root (folder ID: "0")
└── Easyeditor/
    ├── note1.md
    ├── note2.md
    └── ...
```

## Security Best Practices

1. **Never expose secrets**
   - Keep Client Secret in environment variables only
   - Don't commit to version control
   - Don't log secrets in console

2. **Use PKCE** (Proof Key for Code Exchange)
   - Already implemented in the EasyEditor Box provider
   - Adds extra security layer for OAuth in public clients

3. **Validate redirect URIs**
   - Only add trusted domains
   - Use HTTPS in production

4. **Rotate credentials**
   - Periodically generate a new Client Secret in the Developer Console
   - Update environment variables
   - Users will need to reconnect

5. **Monitor usage**
   - Check Box Developer Console for usage stats
   - Watch for unusual patterns
   - Set up alerts for errors

## Additional Resources

- **Box Developer Documentation**: https://developer.box.com/
- **Box OAuth 2.0 Guide**: https://developer.box.com/guides/authentication/oauth2/
- **Box API Reference**: https://developer.box.com/reference/
- **Box Developer Console**: https://app.box.com/developers/console
- **Box Community Forum**: https://forum.box.com/

## Next Steps

After completing this setup:

1. ✅ Box App created
2. ✅ OAuth 2.0 settings configured
3. ✅ Credentials added to environment variables
4. ✅ Development testing completed
5. 🔄 Ready to use Box integration (follow tasks.md)
6. 🔄 Production deployment and testing

---

**Need Help?**

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Box API documentation
3. Check browser console for error messages
4. Verify environment variables are loaded correctly
5. Test with Box API Reference explorer to isolate issues
