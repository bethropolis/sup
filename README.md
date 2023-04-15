# Sup - A Package Manager for Suplike

Sup is a package manager for [Suplike](https://github.com/bethropolis/suplike-social-website), an open source social network. 
Sup is designed to simplify plugin management. It has the following commands:

- `install`: Installs a package.
- `remove`: Removes a package.
- `publish`: Publishes a package to Suplike.
- `init`: Initializes a new package.

## Installation

To use Sup, you first need to install it. You can do this by running the following command:

```
 npm install -g sup-cli
```


## Usage

To use Sup, you must navigate to the directory of the package you wish to install, remove or publish.

### Initializing a new package

To initialize a new package, run the following command:
```
 sup init <package-name>
 
 ```
 
This will create a `<package-name>` folder in the current directory with `suplike.json` file.


### Installing a package

To install a package, run the following command:
```
 sup install <package-name>
```


This will download the package and all its dependencies from the Suplike registry and install them.

### Removing a package

To remove a package, run the following command:
```
 sup remove <package-name>
 ```
 
 
This will remove the package and all its dependencies from your system.

### Publishing a package

To publish a package to Suplike, you must first create an account and obtain an access token. Once you have an access token, run the following command:

```
 sup publish <package-name>
```

This will publish the package to Suplike, making it available for other developers to use.

## final
Thanks for reading! , bye.


> this project purpose was accutually mainly for me to learn about package management.


