# OneDrive Integration Setup

## For End Users

**Good news!** The OneDrive integration is pre-configured and ready to use. No technical setup required!

### How to Use OneDrive Integration

1. **Open EasyNotes Sidebar**: Click the "EasyNotes" button in the menu bar
2. **Connect to OneDrive**: Click the "Connect" button next to OneDrive
3. **Authorize Access**: A Microsoft sign-in window will open
   - Sign in with your Microsoft account
   - Review the permissions (EasyEditor only requests access to its own application folder)
   - Click "Accept" to grant access
4. **Start Creating Notes**: Once connected, your notes are saved to a dedicated "Easyeditor" folder in your OneDrive

### What Permissions Does EasyEditor Need?

EasyEditor uses the `Files.ReadWrite.AppFolder` scope, which means:
- ✅ EasyEditor can only access files in its own application folder
- ✅ Your existing OneDrive files are completely private
- ✅ EasyEditor cannot see or access any other files in your OneDrive
- ✅ You can revoke access anytime from your Microsoft Account settings

### Managing Your Connection

- **Disconnect**: Click "Disconnect" in the EasyNotes sidebar to sign out
- **Revoke Access**: Visit [Microsoft Account App Permissions](https://account.live.com/consent/Manage) to completely revoke access

---

## For Developers

If you're forking this project or need to use your own credentials, follow the steps below to register a Microsoft Azure application and configure the OneDrive integration.

### Step 1: Register an Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in the application details:
   - **Name**: "EasyEditor" (or your preferred app name)
   - **Supported account types**: Select "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: Leave blank for now (configured in Step 3)
5. Click **Register**
6. On the app overview page, copy the **Application (client) ID** — this is your `VITE_ONEDRIVE_CLIENT_ID`

### Step 2: Create a Client Secret

1. In your registered app, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description (e.g., "EasyEditor Dev") and choose an expiration period
4. Click **Add**
5. Copy the **Value** immediately — this is your `VITE_ONEDRIVE_CLIENT_SECRET`
   - ⚠️ The secret value is only shown once. Copy it now or you'll need to create a new one.

### Step 3: Configure Redirect URIs

1. In your registered app, go to **Authentication**
2. Click **Add a platform** > **Web**
3. Add the following redirect URIs:

**Development:**
```
http://localhost:3024/onedrive-oauth-callback.html
```

**Production:**
```
https://easyeditor.co.uk/onedrive-oauth-callback.html
```

4. Under **Implicit grant and hybrid flows**, check:
   - ✅ Access tokens
   - ✅ ID tokens
5. Click **Configure**

### Step 4: Configure API Permissions

1. In your registered app, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and add the following permission:
   - `Files.ReadWrite.AppFolder`
6. Also ensure `offline_access` is present (usually added by default) — this enables refresh tokens
7. Click **Add permissions**
8. If you have admin access, click **Grant admin consent** (optional for development with test users)

### Step 5: Set Environment Variables

Create or edit the `.env.local` file in the project root:

```env
VITE_ONEDRIVE_CLIENT_ID=your-application-client-id-here
VITE_ONEDRIVE_CLIENT_SECRET=your-client-secret-value-here
```

Replace the placeholder values with the credentials from Steps 1 and 2.

### Step 6: Add Test Users (Development)

While your app is in development and not yet verified by Microsoft, only registered test users can authenticate:

1. Go to [Azure Portal](https://portal.azure.com/) > **App registrations** > your app
2. Go to **Authentication**
3. Under **Supported account types**, ensure "Accounts in any organizational directory and personal Microsoft accounts" is selected
4. Go back to the app overview and navigate to **Users and groups** (for organizational apps) or note that personal Microsoft accounts can be added as test users
5. Alternatively, go to **Azure Active Directory** > **Enterprise applications** > your app > **Users and groups**
6. Click **Add user/group** and add the Microsoft accounts that need access during development

> **Note:** Once your app is verified and published, all Microsoft account holders can authenticate without being added as test users.

### Step 7: Validate Configuration

After setting up your environment variables, start the application and check the browser console for configuration validation messages. The app includes built-in validation that checks:

- Client ID is present and not a placeholder
- Client secret is present and not a placeholder
- Both values have sufficient length (> 10 characters)

If configuration is invalid, the OneDrive connect button will show an appropriate error message.

### Step 8: Test the Integration

1. Run the application (`npm run dev`)
2. Open the EasyNotes sidebar
3. Click "Connect" next to OneDrive
4. Sign in with a test user Microsoft account
5. Grant the requested permissions
6. Verify notes can be created, listed, and managed in the "Easyeditor" folder

---

## Security Notes

- OAuth Client IDs are public by design (they're in client-side code)
- Client secrets should not be committed to public repositories
- The `Files.ReadWrite.AppFolder` scope ensures EasyEditor can only access its own folder
- Users authenticate with their own Microsoft accounts
- Users can revoke access anytime from their Microsoft Account settings
- Never commit `.env.local` to version control

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Configuration not valid" error | Check that `VITE_ONEDRIVE_CLIENT_ID` and `VITE_ONEDRIVE_CLIENT_SECRET` are set in `.env.local` and are not placeholder values |
| "AADSTS50011: Reply URL does not match" | Ensure the redirect URI in Azure Portal exactly matches `http://localhost:3024/onedrive-oauth-callback.html` (dev) or `https://easyeditor.co.uk/onedrive-oauth-callback.html` (prod) |
| "Need admin approval" | Add the user as a test user (Step 6) or have an admin grant consent |
| Authentication popup closes immediately | Check browser popup blocker settings |
| Token refresh fails | The client secret may have expired — create a new one in Azure Portal |
