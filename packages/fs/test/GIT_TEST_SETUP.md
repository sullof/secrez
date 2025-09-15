# GitConflictChecker Test Setup

This test requires a GitHub repository to test git conflict detection functionality.

## Repository Setup

1. **Create a test repository on GitHub:**
   - Create a new repository (e.g., `secrez-test-repo`)
   - Make it private or public (your choice)
   - Initialize with a README.md file

## SSH Key Setup

2. **Generate SSH key:**

```bash
ssh-keygen -t ed25519 -f ./secrez_test_key -C "secrez-test@example.com"
```

(Press Enter for no passphrase)

3. **Add public key to GitHub as Deploy Key:**

   - Copy the content of `secrez_test_key.pub`
   - Go to your test repository: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/settings/keys`
   - Click "Add deploy key"
   - Paste the public key
   - Name it "Secrez Test Key"
   - **Check "Allow write access"** (crucial for pushing changes)

4. **Create .env file:**

```bash
# Create .env file in packages/fs/ (root of the package)
cat > .env << 'EOF'
SECREZ_TEST_REPO_URL="git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git"
SECREZ_TEST_SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
your-private-key-content-here
-----END OPENSSH PRIVATE KEY-----"
EOF
```

5. **Test SSH connection:**

```bash
# Create temporary key file for testing
cp ./secrez_test_key /tmp/test_key
chmod 600 /tmp/test_key
ssh -i /tmp/test_key -T git@github.com
rm /tmp/test_key
```

You should see: "Hi YOUR_USERNAME/YOUR_REPO_NAME! You've successfully authenticated..."

## Running Tests

6. **Run the tests:**

```bash
npm run test-only
```

## Security Notes

- The private key is stored in environment variables, not in the repository
- Temporary SSH key files are created in the test directory and automatically cleaned up
- The test directory is completely removed after tests complete
- Never commit private keys to the repository
- The `.env` file should be added to `.gitignore` to prevent accidental commits
