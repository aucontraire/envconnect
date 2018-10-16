# Copyright (c) 2018, DjaoDjin inc.
# see LICENSE.

import logging
from collections import namedtuple

from deployutils.helpers import datetime_or_now
from django.db import connection
from survey.models import Answer, Sample

from .models import Consumption, get_scored_answers


LOGGER = logging.getLogger(__name__)


def as_valid_sheet_title(title):
    """
    Prevents 'Invalid character / found in sheet title' errors.
    """
    return title.replace('/', '-')


def freeze_scores(sample, includes=None, excludes=None,
                  collected_by=None, created_at=None):
    LOGGER.info("freeze scores for %s", sample.account)
    created_at = datetime_or_now(created_at)
    scored_answers = get_scored_answers(
        population=Consumption.objects.get_active_by_accounts(
            excludes=excludes),
        includes=includes)
    score_sample = Sample.objects.create(
        created_at=created_at,
        survey=sample.survey,
        account=sample.account,
        extra=sample.extra,
        is_frozen=True)
    with connection.cursor() as cursor:
        cursor.execute(scored_answers, params=None)
        col_headers = cursor.description
        decorated_answer_tuple = namedtuple(
            'DecoratedAnswerTuple', [col[0] for col in col_headers])
        for decorated_answer in cursor.fetchall():
            decorated_answer = decorated_answer_tuple(
                *decorated_answer)
            if decorated_answer.answer_id:
                numerator = decorated_answer.numerator
                denominator = decorated_answer.denominator
                _ = Answer.objects.create(
                    created_at=created_at,
                    question_id=decorated_answer.id,
                    metric_id=2,
                    measured=numerator,
                    denominator=denominator,
                    collected_by=collected_by,
                    sample=score_sample,
                    rank=decorated_answer.rank)
    sample.created_at = datetime_or_now()
    sample.save()
    return score_sample