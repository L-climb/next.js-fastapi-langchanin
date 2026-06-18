"""
调度器路由
提供定时任务的管理接口
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.scheduler.tasks import add_job, get_jobs, remove_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


# ==================== 请求/响应模型 ====================


class JobResponse(BaseModel):
    """任务响应"""
    id: str
    name: str
    trigger: str
    next_run_time: str | None = None


class CreateJobRequest(BaseModel):
    """创建任务请求"""
    job_id: str
    name: str = ""
    interval_minutes: int = 60


# ==================== 路由处理 ====================


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs():
    """获取所有定时任务"""
    jobs = get_jobs()
    return [JobResponse(**job) for job in jobs]


@router.post("/jobs", response_model=JobResponse)
async def create_job(request: CreateJobRequest):
    """创建定时任务"""
    try:
        add_job(
            job_id=request.job_id,
            trigger="interval",
            minutes=request.interval_minutes,
            name=request.name or request.job_id,
        )

        # 返回创建的任务信息
        jobs = get_jobs()
        for job in jobs:
            if job["id"] == request.job_id:
                return JobResponse(**job)

        return JobResponse(
            id=request.job_id,
            name=request.name or request.job_id,
            trigger=f"interval[{request.interval_minutes} minutes]",
            next_run_time=None,
        )

    except Exception as e:
        logger.error(f"创建任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """删除定时任务"""
    try:
        remove_job(job_id)
        return {"message": f"任务 {job_id} 已删除"}
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(status_code=404, detail=f"任务 {job_id} 不存在或删除失败")
