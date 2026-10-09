"""LESSON route services."""
from .content import Content


def list_management(request, principal):
    return Content("LESSON").list_management(request, principal)


def list_published(request, principal):
    return Content("LESSON").list_published(request, principal)


def get_published(request, principal):
    return Content("LESSON").get_published(request, principal)


def create_draft(request, principal):
    return Content("LESSON").create_draft(request, principal)


def save_draft(request, principal):
    return Content("LESSON").save_draft(request, principal)


def publish(request, principal):
    return Content("LESSON").publish(request, principal)


def archive(request, principal):
    return Content("LESSON").archive(request, principal)


def restore(request, principal):
    return Content("LESSON").restore(request, principal)


def get_management(request, principal):
    return Content("LESSON").get_management(request, principal)
