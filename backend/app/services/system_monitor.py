import os
import psutil
import shutil
from typing import Dict, Any

class SystemMonitor:
    @staticmethod
    def get_system_status(active_sessions_count: int = 0) -> Dict[str, Any]:
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)
        
        # Memory metrics
        mem = psutil.virtual_memory()
        ram_total_gb = round(mem.total / (1024 ** 3), 2)
        ram_used_gb = round(mem.used / (1024 ** 3), 2)
        ram_available_gb = round(mem.available / (1024 ** 3), 2)
        ram_percent = mem.percent
        
        # Disk metrics (Persistent storage on EBS root volume)
        disk_path = "/" if os.name != "nt" else "C:\\"
        try:
            disk = psutil.disk_usage(disk_path)
            disk_total_gb = round(disk.total / (1024 ** 3), 2)
            disk_used_gb = round(disk.used / (1024 ** 3), 2)
            disk_free_gb = round(disk.free / (1024 ** 3), 2)
            disk_percent = disk.percent
        except Exception:
            disk_total_gb = 50.0
            disk_used_gb = 10.0
            disk_free_gb = 40.0
            disk_percent = 20.0

        # Load average (Linux only)
        load_avg = []
        if hasattr(os, "getloadavg"):
            load_avg = [round(x, 2) for x in os.getloadavg()]

        # Health status check against C7i limits
        healthy = (cpu_percent < 95.0) and (ram_percent < 95.0)
        
        return {
            "status": "healthy" if healthy else "degraded",
            "cpu": {
                "percent": cpu_percent,
                "cores": cpu_count,
                "load_avg": load_avg,
                "model": "AWS EC2 C7i Large (CPU-Optimized)"
            },
            "ram": {
                "total_gb": ram_total_gb,
                "used_gb": ram_used_gb,
                "available_gb": ram_available_gb,
                "percent": ram_percent
            },
            "disk": {
                "total_gb": disk_total_gb,
                "used_gb": disk_used_gb,
                "free_gb": disk_free_gb,
                "percent": disk_percent
            },
            "cloud": {
                "provider": "AWS",
                "instance": "c7i.large",
                "rendering_mode": "Software (LLVMpipe / CPU 4-vCPU)",
                "gpu": "None (Optimized for 2D/Low-spec Games)"
            },
            "active_sessions": active_sessions_count
        }

system_monitor = SystemMonitor()

