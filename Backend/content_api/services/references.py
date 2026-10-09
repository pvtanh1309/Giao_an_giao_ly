"""REFERENCE route services."""
from .content import Content


def list_published(request, principal):
    return Content("REFERENCE").list_published(request, principal)


def get_published(request, principal):
    return Content("REFERENCE").get_published(request, principal)


def create_draft(request, principal):
    return Content("REFERENCE").create_draft(request, principal)


def save_draft(request, principal):
    return Content("REFERENCE").save_draft(request, principal)


def publish(request, principal):
    return Content("REFERENCE").publish(request, principal)


def archive(request, principal):
    return Content("REFERENCE").archive(request, principal)


def restore(request, principal):
    return Content("REFERENCE").restore(request, principal)


def get_management(request, principal):
    return Content("REFERENCE").get_management(request, principal)


def list_management(request, principal):
    return Content("REFERENCE").list_management(request, principal)
