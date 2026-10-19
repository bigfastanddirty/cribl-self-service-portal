#!/usr/bin/env python3
"""Verify public assets in the deployment archive are service-readable."""
import pathlib
import tarfile
bundle = pathlib.Path(__file__).resolve().parents[2] / 'vendor/cribl-self-service-rhel8-0.1.0.tar.gz'
with tarfile.open(bundle) as archive:
    assets = [m for m in archive.getmembers() if '/app/dist/' in m.name]
    assert assets, 'No public assets found'
    unreadable = [m.name for m in assets if (m.isfile() and m.mode & 0o444 != 0o444) or (m.isdir() and m.mode & 0o555 != 0o555)]
    assert not unreadable, 'Assets inaccessible to service account: ' + ', '.join(unreadable)
print('PASS: all bundled public assets are readable/traversable by the service account')
