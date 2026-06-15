# Security Policy

## Supported Versions

Security fixes are applied to the latest code on the `main` branch.

## Reporting a Vulnerability

Do not report security vulnerabilities in a public issue, discussion, or pull
request.

Use GitHub's private vulnerability reporting or security advisory feature for
this repository:

1. Open the repository's **Security** tab.
2. Select **Advisories**.
3. Select **Report a vulnerability** or **New draft security advisory**.
4. Include reproduction steps, affected behavior, impact, and any suggested
   mitigation.

If private reporting is unavailable, contact the repository owner privately
through their GitHub profile and request a secure reporting channel. Do not
send secrets or exploit details through a public channel.

You should receive an initial acknowledgment within seven days. Please allow
the maintainer time to investigate and release a fix before publicly
disclosing the vulnerability.

## Scope

Relevant reports include:

- Exposure or unintended persistence of JSON entered into the application.
- Secret-redaction bypasses that could cause credentials to be shared.
- Cross-site scripting or unsafe code execution.
- Dependency or deployment issues that directly affect this application.

Reports about unsupported browsers, general dependency age, or vulnerabilities
that cannot affect the deployed application may be closed without a security
release.
