"""PROGRAM route services."""
from .content import Content


def list_management(request, principal):
    return Content("PROGRAM").list_management(request, principal)


def get_management(request, principal):
    return Content("PROGRAM").get_management(request, principal)


def list_published(request, principal):
    return Content("PROGRAM").list_published(request, principal)


def get_published(request, principal):
    return Content("PROGRAM").get_published(request, principal)


def create_draft(request, principal):
    return Content("PROGRAM").create_draft(request, principal)


def save_draft(request, principal):
    return Content("PROGRAM").save_draft(request, principal)


def publish(request, principal):
    return Content("PROGRAM").publish(request, principal)


def archive(request, principal):
    return Content("PROGRAM").archive(request, principal)


def restore(request, principal):
    return Content("PROGRAM").restore(request, principal)
