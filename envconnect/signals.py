# Copyright (c) 2017, DjaoDjin inc.
# see LICENSE.

from answers.models import Follow, Question
from answers.signals import question_new
from django.contrib.contenttypes.models import ContentType
from django.contrib.sites.models import Site
from django.contrib.sites.requests import RequestSite
from django.dispatch import receiver
from django_comments.signals import comment_was_posted
from extended_templates.backends import get_email_backend

#pylint: disable=unused-argument
def get_site(request):
    if Site._meta.installed: #pylint: disable=protected-access
        site = Site.objects.get_current()
    else:
        site = RequestSite(request)
    return site


@receiver(question_new, dispatch_uid="question_new_notice")
def on_question_new(sender, question, request, *args, **kwargs):
    broker = request.session.get('site', {})
    notify_email = broker['email']
    get_email_backend().send(
        recipients=[notify_email],
        template='notification/question_new.eml',
        context={'question': question, 'site': get_site(request)})


@receiver(comment_was_posted, dispatch_uid="comment_was_posted_notice")
def on_answer_posted(sender, comment, request, *args, **kwargs):
    question_ctype = ContentType.objects.get_for_model(Question)
    if comment.content_type == question_ctype:
        question = comment.content_object
        best_practice_url = request.POST.get('next', "")
        get_email_backend().send(
            recipients=[notified.email
                        for notified in Follow.objects.get_followers(question)],
            template='notification/question_updated.eml',
            context={'question': question,
                     'best_practice_url': best_practice_url,
                     'site': get_site(request)})
        # Subscribe the commenting user to this question
        Follow.objects.subscribe(request.user, question)
