"""security_alarm.py, security.yml's one script (AF-121): what it makes of
the open alerts, without GitHub. Each alert is read into a group, a group
is filed once, and an alert any open issue already names is never filed
again."""
import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "security_alarm", os.path.join(ROOT, ".github", "scripts", "security_alarm.py"))
alarm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alarm)

REPO = "o/r"


def url(kind, n):
    return f"https://github.com/{REPO}/security/{kind}/{n}"


def code(n, rule="py/redos", path="data/harvest.py", security=None, severity="warning"):
    return dict(number=n, html_url=url("code-scanning", n),
                rule=dict(id=rule, description="Inefficient regular expression",
                          security_severity_level=security, severity=severity),
                most_recent_instance=dict(location=dict(path=path, start_line=7)))


def dep(n, name="vite", severity="medium"):
    return dict(number=n, html_url=url("dependabot", n),
                dependency=dict(package=dict(ecosystem="npm", name=name),
                                manifest_path="web/package-lock.json"),
                security_advisory=dict(ghsa_id="GHSA-xxxx", summary="A flaw", severity=severity))


def mine(n, body):
    """An open issue this job opened, as the REST listing gives it."""
    return dict(number=n, body=body, user=dict(login="github-actions[bot]"),
                author_association="CONTRIBUTOR", labels=[])


def by(n, body, association):
    return dict(number=n, body=body, user=dict(login="someone"), author_association=association)


def secret(n):
    return dict(number=n, html_url=url("secret-scanning", n), secret_type="github_pat",
                secret_type_display_name="GitHub PAT", secret="ghp_the_value_itself")


class Severity(unittest.TestCase):
    def test_security_severity_first_then_the_rules_own(self):
        cases = [(("critical", "note"), ("high", True)), (("high", None), ("high", True)),
                 (("medium", "note"), ("medium", True)), (("low", "error"), ("low", True)),
                 ((None, "error"), ("medium", True)), ((None, "warning"), ("low", True)),
                 ((None, "note"), ("low", True)), ((None, None), ("medium", False))]
        for (security, severity), want in cases:
            self.assertEqual(alarm.code_severity(code(1, security=security, severity=severity)),
                             want, (security, severity))

    def test_dependabot(self):
        self.assertEqual(alarm.dependabot_severity(dep(1, severity="critical")), ("high", True))
        self.assertEqual(alarm.dependabot_severity(dep(1, severity="low")), ("low", True))
        self.assertEqual(alarm.dependabot_severity(dep(1, severity=None)), ("medium", False))


class Grouping(unittest.TestCase):
    def test_one_group_per_rule_and_file_per_package_and_for_secrets(self):
        found = alarm.groups({"code-scanning": [code(1), code(2), code(3, path="build.py"),
                                                code(4, rule="js/useless")],
                              "dependabot": [dep(5), dep(6), dep(7, name="esbuild")],
                              "secret-scanning": [secret(8), secret(9)]})
        sizes = sorted((g["kind"], len(g["alerts"])) for g in found.values())
        self.assertEqual(sizes, [("code-scanning", 1), ("code-scanning", 1), ("code-scanning", 2),
                                 ("dependabot", 1), ("dependabot", 2), ("secret-scanning", 2)])

    def test_a_secret_is_named_never_described(self):
        found = alarm.groups({"secret-scanning": [secret(8)]})
        (k, g), = found.items()
        text = g["title"] + alarm.body(k, g, g["alerts"], REPO, "RUN")
        for leak in ("ghp_the_value_itself", "GitHub PAT", "github_pat"):
            self.assertNotIn(leak, text)
        self.assertIn(url("secret-scanning", 8), text)
        self.assertEqual(alarm.severity(g["alerts"]), ("high", True))

    def test_alert_text_cannot_close_the_marker(self):
        found = alarm.groups({"code-scanning": [code(1, path="a-->b`<c>.py")]})
        (k, g), = found.items()
        text = alarm.body(k, g, g["alerts"], REPO, "RUN")
        self.assertEqual(text.count("-->"), 1)
        self.assertEqual(alarm.MARK.findall(text), [k])


class Planning(unittest.TestCase):
    def test_an_alert_another_issue_names_is_not_filed(self):
        found = alarm.groups({"code-scanning": [code(1), code(12)]})
        # Alert 12's address contains alert 1's; only 12 is named.
        steps = alarm.plan(found, [by(50, f"see {url('code-scanning', 12)}.", "OWNER")], REPO)
        self.assertEqual([(a, [x[0] for x in new]) for a, _, _, new, _ in steps], [("open", [1])])

    def test_everything_named_files_nothing(self):
        found = alarm.groups({"dependabot": [dep(3)]})
        self.assertEqual(alarm.plan(found, [by(5, url("dependabot", 3), "COLLABORATOR")], REPO), [])

    def test_a_new_alert_in_an_open_group_is_added_to_its_issue(self):
        found = alarm.groups({"code-scanning": [code(1)]})
        (k, g), = found.items()
        old = alarm.body(k, g, g["alerts"], REPO, "RUN1") + "\n**Decided:** a person's note\n"
        found = alarm.groups({"code-scanning": [code(1), code(2)]})
        steps = alarm.plan(found, [mine(9, old)], REPO)
        self.assertEqual([(a, [x[0] for x in new], i["number"]) for a, _, _, new, i in steps],
                         [("add", [2], 9)])
        new = alarm.added(old, steps[0][3], "RUN2")
        self.assertIn("a person's note", new)
        self.assertIn(url("code-scanning", 2), new)
        self.assertEqual(alarm.MARK.findall(new), [k])
        # Now named, so the next run files nothing.
        self.assertEqual(alarm.plan(found, [mine(9, new)], REPO), [])

    def test_a_strangers_issue_neither_holds_back_nor_owns_a_group(self):
        found = alarm.groups({"code-scanning": [code(1)], "secret-scanning": [secret(2)]})
        # Every alert named, and every group's marker copied, by a stranger.
        forged = (f"{url('code-scanning', 1)} {url('secret-scanning', 2)} "
                  + " ".join(f"<!-- security-alert {k} -->" for k in found))
        for association in ("NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR"):
            steps = alarm.plan(found, [by(60, forged, association)], REPO)
            self.assertEqual(sorted((a, i) for a, _, _, _, i in steps),
                             [("open", None), ("open", None)], association)
        # The same body by the owner holds both back, though it owns neither.
        self.assertEqual(alarm.plan(found, [by(60, forged, "OWNER")], REPO), [])

    def test_a_raise_is_noted_in_the_added_block(self):
        found = alarm.groups({"code-scanning": [code(1)]})
        (k, g), = found.items()
        old = alarm.body(k, g, g["alerts"], REPO, "RUN1")
        self.assertIn("raised to high", alarm.added(old, g["alerts"], "RUN2", "high"))
        self.assertNotIn("raised", alarm.added(old, g["alerts"], "RUN2"))

    def test_highest_severity_first(self):
        found = alarm.groups({"code-scanning": [code(1, severity="note")],
                              "dependabot": [dep(2, severity="high")]})
        self.assertEqual([s[2]["kind"] for s in alarm.plan(found, [], REPO)],
                         ["dependabot", "code-scanning"])


class Workflows(unittest.TestCase):
    def test_a_workflow_alert_is_given_by_its_address_alone(self):
        for rule, path in (("actions/code-injection/critical", ".github/workflows/x.yml"),
                           ("py/command-line-injection", ".github/scripts/refresh_alarm.py")):
            found = alarm.groups({"code-scanning": [code(3, rule=rule, path=path)]})
            (k, g), = found.items()
            text = g["title"] + alarm.body(k, g, g["alerts"], REPO, "RUN")
            for leak in (rule, path, "Inefficient regular expression"):
                self.assertNotIn(leak, text)
            self.assertIn(url("code-scanning", 3), text)

    def test_other_alerts_keep_their_rule_and_file(self):
        found = alarm.groups({"code-scanning": [code(3)]})
        (k, g), = found.items()
        text = g["title"] + alarm.body(k, g, g["alerts"], REPO, "RUN")
        self.assertIn("data/harvest.py", text)
        self.assertIn("py/redos", text)


class Ids(unittest.TestCase):
    def test_next_number(self):
        self.assertEqual(alarm.next_number(["SC-03: a", "SC-11: b", "AF-40: c"]), 12)
        self.assertEqual(alarm.next_number([]), 1)


if __name__ == "__main__":
    unittest.main()
