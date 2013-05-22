Burndown
========

Burndown before you burnout.

## Installation

### Prerequisites (if needed):

#### Ruby

I recommend installing with [RVM](https://rvm.io/rvm/install/).

```bash
$ \curl -#L https://get.rvm.io | bash -s stable --autolibs=3 --ruby
```

#### Github Application

Create a new application [here](https://github.com/settings/applications/new).

**NOTE**: These settings are for local development. Please change according to
your environment!

- Name: Burndown is awesome
- URL: http://localhost:3000
- Callback URL: http://localhost:3000/auth/github/callback

Now add your Github application **client id** and **client secret** to
environment variables

```bash
$ echo 'export GITHUB_KEY=client_id_here' >> ~/.bashrc
$ echo 'export GITHUB_SECRET=client_secret_here' >> ~/.bashrc
```

### Burndown

Install Burndown:

```bash
$ git clone git@github.com:appneta/burndown.git
$ cd burndown/
$ bundle
$ rake db:migrate
```

Start the server:

```bash
$ source ~/.bashrc
$ rails s
```

Now, just head over to [http://127.0.0.1:3000](http://127.0.0.1:3000) in your
favorite browser and start burning down!
