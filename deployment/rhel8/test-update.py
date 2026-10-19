#!/usr/bin/env python3
"""Isolated updater tests. Requires passwordless sudo; never calls real systemctl."""
import os, pathlib, shutil, subprocess, tempfile
repo = pathlib.Path(__file__).resolve().parents[2]
for scenario in ['running', 'stopped', 'failed-start', 'bad-checksum']:
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        opt = root/'opt'; opt.mkdir()
        clone=root/'repo'; (clone/'vendor').mkdir(parents=True)
        shutil.copy(repo/'vendor/cribl-self-service-rhel8-0.1.0.tar.gz',clone/'vendor/app.tar.gz')
        (clone/'vendor/app.tar.gz').rename(clone/'vendor/cribl-self-service-rhel8-0.1.0.tar.gz')
        package=clone/'vendor/cribl-self-service-rhel8-0.1.0.tar.gz'
        digest=subprocess.check_output(['sha256sum',str(package)],text=True).split()[0]
        (clone/'vendor/SHA256SUMS').write_text(('0'*64 if scenario=='bad-checksum' else digest)+'  '+package.name+'\n')
        target=opt/'cribl-self-service'; (target/'runtime/bin').mkdir(parents=True)
        (target/'server.mjs').write_text('// old application\n')
        node=target/'runtime/bin/node'; node.write_text('#!/bin/sh\nif [ "$1" = --version ]; then echo v22.22.1; fi\n'); node.chmod(0o755)
        mock=root/'mock'; mock.mkdir()
        state=root/'active'; state.write_text('no' if scenario=='stopped' else 'yes')
        starts=root/'starts'; starts.write_text('0')
        svc=mock/'systemctl'; svc.write_text(f'''#!/bin/bash
case "$1" in
is-active) [[ $(cat {state}) == yes ]];;
stop) echo no > {state};;
start) count=$(cat {starts}); echo $((count+1)) > {starts}; if [[ {scenario} == failed-start && $count == 0 ]]; then exit 1; fi; echo yes > {state};;
esac
'''); svc.chmod(0o755)
        restore=mock/'restorecon';restore.write_text('#!/bin/sh\nexit 0\n');restore.chmod(0o755)
        updater=clone/'update.sh';updater.write_text((repo/'update.sh').read_text().replace('/opt/',str(opt)+'/'))
        result=subprocess.run(['sudo','-n','env','PATH='+str(mock)+':'+os.environ['PATH'],'bash',str(updater)],capture_output=True,text=True)
        assert result.returncode == (1 if scenario in ['failed-start','bad-checksum'] else 0), result.stdout+result.stderr
        if scenario in ['failed-start','bad-checksum']: assert (target/'server.mjs').read_text()=='// old application\n'
        else: assert (target/'source-types.mjs').is_file()
        assert state.read_text().strip()==('no' if scenario=='stopped' else 'yes')
        assert node.is_file()
        # Remove root-owned staging/backup files before TemporaryDirectory cleanup.
        subprocess.run(['sudo','-n','chown','-R',str(os.getuid())+':'+str(os.getgid()),tmp],check=True)
        print('PASS:',scenario)
