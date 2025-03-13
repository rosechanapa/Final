from PyInstaller.utils.hooks import collect_submodules
hiddenimports = collect_submodules('dns')

# ตรวจสอบก่อน import dns.dnssec และ dns.namedict
for submod in ['dns.dnssec', 'dns.namedict']:
    try:
        __import__(submod)
        hiddenimports += collect_submodules(submod)
    except ImportError:
        pass

hiddenimports += collect_submodules('eventlet.hubs')