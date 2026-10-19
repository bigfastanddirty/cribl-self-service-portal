# Install the Cribl Self-Service Portal on RHEL 8

1. Install the prerequisites listed in REQUIREMENTS.md. Copy the archive to the
   RHEL box, then extract and install:

```bash
tar -xzf cribl-self-service-rhel8-0.1.0.tar.gz
cd cribl-self-service-rhel8-0.1.0
./install.sh --check
sudo ./install.sh
```

2. Edit `/etc/cribl-self-service/portal.env` to set the reachable Leader URL.
   Edit `/etc/cribl-self-service/credentials.json` to contain the authorized username
   and password. Use an editor; do not put passwords in shell command arguments.
   Credentials must remain owned by cribl-portal with mode 600. The configuration
   directory is root-managed, and only the service state directory is writable.

3. For HEC provisioning, edit `/etc/cribl-self-service/hec-targets.json` with your
   approved group identifier, existing source identifier, and client-facing endpoint:

```json
{
  "default": {
    "source": "in_splunk_hec",
    "endpoint": "http://hec.internal.example:8088/services/collector"
  }
}
```

   This is an example, not a discovered/approved target. The endpoint port/path/TLS
   must match the source. Leave `{}` to keep HEC unavailable. Do not add restartWorkerId.
   The installer never touches Cribl configuration, creates Workers, or restarts Cribl.
   Provisioning mutations occur only on explicitly submitted HEC requests after setup.

4. Start the portal:

```bash
sudo systemctl enable --now cribl-self-service
sudo systemctl status cribl-self-service
curl -I http://127.0.0.1:4173/
sudo journalctl -u cribl-self-service -n 50 --no-pager
```

   Browse to `http://<RHEL-host-address>:4173/`. Confirm Worker Groups load. If using
   firewalld, an administrator can open the port in the appropriate **internal** zone:

```bash
sudo firewall-cmd --zone=internal --add-port=4173/tcp --permanent
sudo firewall-cmd --reload
```

   Verify that zone's interface/source membership first; these commands are optional
   and are not run by the installer. No Cribl submissions are made by installation
   or health checks. A catalog failure often means the Leader URL, credentials, access
   policy, or network connection needs correcting. Do not print secrets into logs.

## Email (paused)

Do not enable mail until the owner supplies relay settings. When authorized, copy
smtp.json.example to smtp.json, replace its examples, give it owner cribl-portal and
mode 600, and uncomment the two mail environment variables. Restart only the portal
when no HEC operation is pending. Summaries omit credentials and samples.

## Backup, removal, and upgrades

Back up `/etc/cribl-self-service` and `/var/lib/cribl-self-service` securely: they may
contain passwords and ingestion tokens. Do not copy them into public/source archives.
The installer deliberately refuses an existing installation rather than overwriting
private configuration or state. Review an upgrade while preserving those paths.

For removal, stop/disable `cribl-self-service` and remove its service unit/application
files only after backing up state. Removing the portal does **not** revoke Cribl HEC
credentials. Retain private state until an administrator reviews token ownership.

The bundle includes built assets, backend modules, Nodemailer, configuration examples,
SHA-256 checksums, requirements, and this guide. It excludes all development credentials,
request journals, source samples, build tools, and VM-specific endpoint mappings.
